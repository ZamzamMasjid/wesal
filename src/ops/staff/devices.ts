import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { staffDevice } from "@/db/schema";

// Device registration for push notifications (docs/features/push-notifications).
// A device is identified by its Expo push token; signing in on it again moves it
// to the new staff user. Logout deletes the row, and an account can only remove
// its own devices.

export interface DeviceDeps {
  db: Database;
}

function actorId(caller: Caller): string {
  if (caller.kind !== "staff") throw new ApiError("UNAUTHENTICATED");
  return caller.userId;
}

export const registerDeviceInput = z.object({
  token: z.string().trim().min(8).max(400),
  platform: z.enum(["android", "ios"]),
});

export const deviceIdInput = z.object({
  id: z.coerce.number().int().positive(),
});

/** The active push tokens of one staff member, for the outbox sender. */
export async function devicesForUser(
  db: Database,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ token: staffDevice.token })
    .from(staffDevice)
    .where(and(eq(staffDevice.userId, userId), eq(staffDevice.active, true)));
  return rows.map((row) => row.token);
}

export function createDeviceOperations(resolve: () => DeviceDeps) {
  const register = defineOperation({
    name: "staff.devices.register",
    access: "staff",
    input: registerDeviceInput,
    handler: async (input, ctx) => {
      const { db } = resolve();
      const userId = actorId(ctx.caller);
      const now = ctx.clock.now();
      const [row] = await db
        .insert(staffDevice)
        .values({
          userId,
          token: input.token,
          platform: input.platform,
          active: true,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: staffDevice.token,
          set: {
            userId,
            platform: input.platform,
            active: true,
            lastSeenAt: now,
            updatedAt: now,
          },
        })
        .returning({ id: staffDevice.id });
      if (!row) throw new ApiError("INTERNAL", "Device not registered.");
      return { id: row.id, platform: input.platform };
    },
  });

  const unregister = defineOperation({
    name: "staff.devices.unregister",
    access: "staff",
    input: deviceIdInput,
    handler: async (input, ctx) => {
      const { db } = resolve();
      const userId = actorId(ctx.caller);
      await db
        .delete(staffDevice)
        .where(
          and(eq(staffDevice.id, input.id), eq(staffDevice.userId, userId)),
        );
      // Removing an already-gone device still means "this device is not to be
      // pushed to", so the answer is a success either way.
      return { unregistered: true };
    },
  });

  return { register, unregister };
}

export const deviceOperations = createDeviceOperations(() => ({ db: getDb() }));

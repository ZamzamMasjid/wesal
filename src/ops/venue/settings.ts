import { eq } from "drizzle-orm";
import { z } from "zod";

import { recordAudit } from "@/audit/audit";
import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { settings } from "@/db/schema";

// Venue settings operations (docs/features/venue-settings): the deposit, the
// booking rules and the payment details. Owner only. Settings is a single row.

export interface SettingsDeps {
  db: Database;
}

const columns = {
  depositPercent: settings.depositPercent,
  holdMinutes: settings.holdMinutes,
  nearSlotCutoffMinutes: settings.nearSlotCutoffMinutes,
  urgentThresholdMinutes: settings.urgentThresholdMinutes,
  maxPhotoMb: settings.maxPhotoMb,
  maxVideoMb: settings.maxVideoMb,
  vodafoneCashNumber: settings.vodafoneCashNumber,
  instapayAddress: settings.instapayAddress,
};

export type VenueSettings = {
  depositPercent: number;
  holdMinutes: number;
  nearSlotCutoffMinutes: number;
  urgentThresholdMinutes: number;
  maxPhotoMb: number;
  maxVideoMb: number;
  vodafoneCashNumber: string | null;
  instapayAddress: string | null;
};

type Executor = Pick<Database, "insert" | "select">;

/** Reads the settings row, creating it with the defaults on first use. */
export async function loadSettings(db: Executor): Promise<VenueSettings> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db
    .select(columns)
    .from(settings)
    .where(eq(settings.id, 1));
  if (!row) throw new ApiError("INTERNAL", "Settings row missing.");
  return row;
}

/** The deposit for a price, in whole EGP (rounded half up). */
export function depositFor(priceEgp: number, depositPercent: number): number {
  return Math.round((priceEgp * depositPercent) / 100);
}

/** Empty text means "not set". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v));

const minutes = z.number().int().min(0).max(100_000);

function actorId(caller: Caller): string {
  if (caller.kind !== "staff") throw new ApiError("UNAUTHENTICATED");
  return caller.userId;
}

export function createSettingsOperations(resolve: () => SettingsDeps) {
  const get = defineOperation({
    name: "staff.settings.get",
    access: "owner",
    input: z.object({}),
    handler: async () => loadSettings(resolve().db),
  });

  const put = defineOperation({
    name: "staff.settings.update",
    access: "owner",
    input: z.object({
      depositPercent: z.number().int().min(1).max(100),
      holdMinutes: z.number().int().min(1).max(1440),
      nearSlotCutoffMinutes: minutes,
      urgentThresholdMinutes: minutes,
      maxPhotoMb: z.number().int().min(1).max(2_000),
      maxVideoMb: z.number().int().min(1).max(20_000),
      vodafoneCashNumber: optionalText(30),
      instapayAddress: optionalText(100),
    }),
    handler: async (input, ctx) => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      return db.transaction(async (tx) => {
        const before = await loadSettings(tx);
        const detail: Record<string, unknown> = {};
        for (const key of Object.keys(columns) as (keyof VenueSettings)[]) {
          if (input[key] !== before[key]) {
            detail[key] = { from: before[key], to: input[key] };
          }
        }
        if (Object.keys(detail).length > 0) {
          await tx
            .update(settings)
            .set({ ...input, updatedAt: ctx.clock.now() })
            .where(eq(settings.id, 1));
          await recordAudit(tx, ctx.clock, {
            actorId: actor,
            action: "settings.update",
            target: "setting:venue",
            detail,
          });
        }
        return loadSettings(tx);
      });
    },
  });

  return { get, put };
}

export const settingsOperations = createSettingsOperations(() => ({
  db: getDb(),
}));

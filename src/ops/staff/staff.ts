import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { listAudit, recordAudit } from "@/audit/audit";
import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import {
  createStaffAccount,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
} from "@/auth/accounts";
import { getAuth, type Auth } from "@/auth/auth";
import { getDb, type Database } from "@/db/client";
import { staffDevice, staffSession, staffUser } from "@/db/schema";

// Staff access operations (docs/features/staff-access). Reading your own
// profile is open to any staff session; managing accounts and reading the audit
// log are owner-only, declared in each definition below.

export interface StaffDeps {
  db: Database;
  auth: Auth;
}

const publicColumns = {
  id: staffUser.id,
  name: staffUser.name,
  username: staffUser.username,
  role: staffUser.role,
  notifyPhone: staffUser.notifyPhone,
  notifyEnabled: staffUser.notifyEnabled,
  alertChannel: staffUser.alertChannel,
  locale: staffUser.locale,
  active: staffUser.active,
};

const password = z.string().min(MIN_PASSWORD_LENGTH).max(128);
const phone = z.string().trim().min(5).max(20).nullable();

function actorId(caller: Caller): string {
  if (caller.kind !== "staff") throw new ApiError("UNAUTHENTICATED");
  return caller.userId;
}

export function createStaffOperations(resolve: () => StaffDeps) {
  const me = defineOperation({
    name: "staff.me",
    access: "staff",
    input: z.object({}),
    handler: async (_input, ctx) => {
      const [user] = await resolve()
        .db.select(publicColumns)
        .from(staffUser)
        .where(eq(staffUser.id, actorId(ctx.caller)));
      if (!user) throw new ApiError("UNAUTHENTICATED");
      return user;
    },
  });

  const updateNotifications = defineOperation({
    name: "staff.me.notifications",
    access: "staff",
    input: z.object({
      notifyPhone: phone,
      notifyEnabled: z.boolean(),
      alertChannel: z.enum(["push", "whatsapp", "both"]).optional(),
      /** The dashboard language alerts are written in. */
      locale: z.enum(["ar", "en"]).optional(),
    }),
    handler: async (input, ctx) => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      await db.transaction(async (tx) => {
        const [target] = await tx
          .select({
            id: staffUser.id,
            notifyPhone: staffUser.notifyPhone,
            notifyEnabled: staffUser.notifyEnabled,
            alertChannel: staffUser.alertChannel,
            locale: staffUser.locale,
          })
          .from(staffUser)
          .where(eq(staffUser.id, actor))
          .for("update");
        if (!target) throw new ApiError("UNAUTHENTICATED");

        const changes: Partial<typeof staffUser.$inferInsert> = {};
        const detail: Record<string, unknown> = {};
        if (input.notifyPhone !== target.notifyPhone) {
          changes.notifyPhone = input.notifyPhone;
          detail.notifyPhone = "changed";
        }
        if (input.notifyEnabled !== target.notifyEnabled) {
          changes.notifyEnabled = input.notifyEnabled;
          detail.notifyEnabled = {
            from: target.notifyEnabled,
            to: input.notifyEnabled,
          };
        }
        if (
          input.alertChannel !== undefined &&
          input.alertChannel !== target.alertChannel
        ) {
          changes.alertChannel = input.alertChannel;
          detail.alertChannel = {
            from: target.alertChannel,
            to: input.alertChannel,
          };
        }
        if (input.locale !== undefined && input.locale !== target.locale) {
          changes.locale = input.locale;
          detail.locale = { from: target.locale, to: input.locale };
        }
        if (Object.keys(changes).length === 0) return;

        await tx
          .update(staffUser)
          .set({ ...changes, updatedAt: ctx.clock.now() })
          .where(eq(staffUser.id, target.id));
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "staff.notify_update",
          target: `staff_user:${target.id}`,
          detail,
        });
      });

      const [user] = await db
        .select(publicColumns)
        .from(staffUser)
        .where(eq(staffUser.id, actor));
      if (!user) throw new ApiError("UNAUTHENTICATED");
      return user;
    },
  });

  const listUsers = defineOperation({
    name: "staff.users.list",
    access: "owner",
    input: z.object({}),
    handler: async () => ({
      users: await resolve()
        .db.select(publicColumns)
        .from(staffUser)
        .orderBy(asc(staffUser.role), asc(staffUser.name)),
    }),
  });

  const createUser = defineOperation({
    name: "staff.users.create",
    access: "owner",
    input: z.object({
      name: z.string().trim().min(1).max(100),
      username: z
        .string()
        .transform(normalizeUsername)
        .pipe(z.string().regex(/^[a-z0-9._-]{3,32}$/)),
      password,
      role: z.enum(["owner", "staff"]).default("staff"),
      notifyPhone: phone.optional(),
      notifyEnabled: z.boolean().optional(),
      alertChannel: z.enum(["push", "whatsapp", "both"]).optional(),
    }),
    handler: async (input, ctx) => {
      const { db, auth } = resolve();
      const actor = actorId(ctx.caller);
      const [taken] = await db
        .select({ id: staffUser.id })
        .from(staffUser)
        .where(eq(staffUser.username, input.username));
      if (taken) {
        throw new ApiError("USERNAME_TAKEN", "That login is already used.");
      }
      const { id } = await createStaffAccount(auth, input);
      await recordAudit(db, ctx.clock, {
        actorId: actor,
        action: "staff.create",
        target: `staff_user:${id}`,
        detail: { username: input.username, role: input.role },
      });
      const [user] = await db
        .select(publicColumns)
        .from(staffUser)
        .where(eq(staffUser.id, id));
      if (!user) throw new ApiError("NOT_FOUND");
      return user;
    },
  });

  const updateUser = defineOperation({
    name: "staff.users.update",
    access: "owner",
    input: z
      .object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(100).optional(),
        role: z.enum(["owner", "staff"]).optional(),
        active: z.boolean().optional(),
        notifyPhone: phone.optional(),
        notifyEnabled: z.boolean().optional(),
        alertChannel: z.enum(["push", "whatsapp", "both"]).optional(),
        /** Resets the password; the user's open sessions end. */
        password: password.optional(),
      })
      .refine(
        (v) =>
          v.name !== undefined ||
          v.role !== undefined ||
          v.active !== undefined ||
          v.notifyPhone !== undefined ||
          v.notifyEnabled !== undefined ||
          v.alertChannel !== undefined ||
          v.password !== undefined,
        { message: "Nothing to change." },
      ),
    handler: async (input, ctx) => {
      const { db, auth } = resolve();
      const actor = actorId(ctx.caller);

      await db.transaction(async (tx) => {
        // Lock every owner row so two concurrent changes cannot both remove the
        // last active owner.
        const owners = await tx
          .select({ id: staffUser.id, active: staffUser.active })
          .from(staffUser)
          .where(eq(staffUser.role, "owner"))
          .for("update");
        const [target] = await tx
          .select()
          .from(staffUser)
          .where(eq(staffUser.id, input.id));
        if (!target) throw new ApiError("NOT_FOUND", "No such staff account.");

        const stopsBeingActiveOwner =
          target.role === "owner" &&
          target.active &&
          (input.role === "staff" || input.active === false);
        if (
          stopsBeingActiveOwner &&
          !owners.some((o) => o.active && o.id !== target.id)
        ) {
          throw new ApiError(
            "LAST_OWNER",
            "There must always be one active owner.",
          );
        }

        const changes: Partial<typeof staffUser.$inferInsert> = {};
        const detail: Record<string, unknown> = {};
        if (input.name !== undefined && input.name !== target.name) {
          changes.name = input.name;
          detail.name = { from: target.name, to: input.name };
        }
        if (input.role !== undefined && input.role !== target.role) {
          changes.role = input.role;
          detail.role = { from: target.role, to: input.role };
        }
        if (input.active !== undefined && input.active !== target.active) {
          changes.active = input.active;
          detail.active = { from: target.active, to: input.active };
        }
        if (
          input.notifyPhone !== undefined &&
          input.notifyPhone !== target.notifyPhone
        ) {
          changes.notifyPhone = input.notifyPhone;
          detail.notifyPhone = "changed";
        }
        if (
          input.notifyEnabled !== undefined &&
          input.notifyEnabled !== target.notifyEnabled
        ) {
          changes.notifyEnabled = input.notifyEnabled;
          detail.notifyEnabled = {
            from: target.notifyEnabled,
            to: input.notifyEnabled,
          };
        }
        if (
          input.alertChannel !== undefined &&
          input.alertChannel !== target.alertChannel
        ) {
          changes.alertChannel = input.alertChannel;
          detail.alertChannel = {
            from: target.alertChannel,
            to: input.alertChannel,
          };
        }
        if (Object.keys(changes).length === 0) return;

        await tx
          .update(staffUser)
          .set({ ...changes, updatedAt: ctx.clock.now() })
          .where(eq(staffUser.id, target.id));
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action:
            changes.active === false
              ? "staff.disable"
              : changes.active === true
                ? "staff.enable"
                : "staff.update",
          target: `staff_user:${target.id}`,
          detail,
        });
        // A disabled account is denied by the caller check already; this also
        // removes its session rows.
        if (changes.active === false) {
          await tx
            .delete(staffSession)
            .where(eq(staffSession.userId, target.id));
          // A disabled account must stop receiving alerts on its phones too.
          await tx.delete(staffDevice).where(eq(staffDevice.userId, target.id));
        }
      });

      if (input.password !== undefined) {
        const context = await auth.$context;
        await context.internalAdapter.updatePassword(
          input.id,
          await context.password.hash(input.password),
        );
        await db.delete(staffSession).where(eq(staffSession.userId, input.id));
        await recordAudit(db, ctx.clock, {
          actorId: actor,
          action: "staff.reset_password",
          target: `staff_user:${input.id}`,
        });
      }

      const [updated] = await db
        .select(publicColumns)
        .from(staffUser)
        .where(eq(staffUser.id, input.id));
      if (!updated) throw new ApiError("NOT_FOUND");
      return updated;
    },
  });

  const audit = defineOperation({
    name: "staff.audit.list",
    access: "owner",
    input: z.object({
      bookingId: z.coerce.number().int().positive().optional(),
      before: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
    handler: async (input) => ({
      entries: await listAudit(resolve().db, input),
    }),
  });

  return { me, updateNotifications, listUsers, createUser, updateUser, audit };
}

export const staffOperations = createStaffOperations(() => ({
  db: getDb(),
  auth: getAuth(),
}));

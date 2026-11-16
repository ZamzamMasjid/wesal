import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { recordAudit } from "@/audit/audit";
import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { dateException, exceptionSlot, slotPattern } from "@/db/schema";
import { cairoDay, isValidDay } from "@/lib/cairo-time";

import {
  findConflicts,
  noBookingsYet,
  type ActiveBookingFinder,
} from "./conflicts";
import {
  compareSlots,
  loadExceptions,
  loadPattern,
  resolveDay,
  type DateException,
  type PatternSlot,
  type ResolvedDay,
  type Slot,
} from "./resolver";

// Schedule operations (docs/features/slot-schedule): the weekly pattern and
// date exceptions. Owner only. Reading slots for a date is the resolver's job
// (./resolver), used by the public calendar and the hold endpoint.

export interface ScheduleDeps {
  db: Database;
  /** Finds active bookings for the edit guard. Replaced when bookings exist. */
  activeBookings?: ActiveBookingFinder;
}

const MAX_SLOTS_PER_DAY = 20;

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (00:00 to 23:59).");

const slot = z.object({ start: time, end: time });

type Issue = { path: (string | number)[]; message: string; code: "custom" };

/** Per-slot problems, reported at the offending slot so the form can mark it. */
function slotIssues(slots: Slot[], prefix: (string | number)[]): Issue[] {
  const issues: Issue[] = [];
  slots.forEach((s, i) => {
    if (s.end <= s.start) {
      issues.push({
        path: [...prefix, i, "end"],
        message: "A slot must end after it starts.",
        code: "custom",
      });
    }
  });
  const valid = slots
    .map((s, index) => ({ ...s, index }))
    .filter((s) => s.end > s.start)
    .sort(compareSlots);
  for (let i = 1; i < valid.length; i++) {
    const previous = valid[i - 1]!;
    const current = valid[i]!;
    if (current.start < previous.end) {
      issues.push({
        path: [...prefix, current.index, "start"],
        message: "Slots on one day may not overlap.",
        code: "custom",
      });
    }
  }
  return issues;
}

const patternInput = z
  .object({
    slots: z
      .array(slot.extend({ weekday: z.number().int().min(0).max(6) }))
      .max(7 * MAX_SLOTS_PER_DAY),
  })
  .superRefine((value, ctx) => {
    for (let weekday = 0; weekday <= 6; weekday++) {
      const indexes = value.slots
        .map((s, index) => ({ s, index }))
        .filter(({ s }) => s.weekday === weekday);
      if (indexes.length > MAX_SLOTS_PER_DAY) {
        ctx.addIssue({
          code: "custom",
          path: ["slots", indexes[MAX_SLOTS_PER_DAY]!.index],
          message: "Too many slots on one day.",
        });
      }
      for (const issue of slotIssues(
        indexes.map(({ s }) => s),
        [],
      )) {
        // Map the index within the day back to the index in the whole list.
        const local = issue.path[0] as number;
        ctx.addIssue({
          ...issue,
          path: ["slots", indexes[local]!.index, ...issue.path.slice(1)],
        });
      }
    }
  });

const dayField = z
  .string()
  .refine(isValidDay, "Use a real date written YYYY-MM-DD.");

const exceptionInput = z
  .object({
    date: dayField,
    closed: z.boolean(),
    note: z
      .string()
      .trim()
      .max(200)
      .nullish()
      .transform((v) => (v ? v : null)),
    slots: z.array(slot).max(MAX_SLOTS_PER_DAY).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.closed && value.slots.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["slots"],
        message: "A closed date has no slots.",
      });
    }
    if (!value.closed && value.slots.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["slots"],
        message: "Add at least one slot, or close the date.",
      });
    }
    for (const issue of slotIssues(value.slots, ["slots"])) {
      ctx.addIssue(issue);
    }
  });

function actorId(caller: Caller): string {
  if (caller.kind !== "staff") throw new ApiError("UNAUTHENTICATED");
  return caller.userId;
}

/** Serializes schedule edits so the guard reads a stable schedule. */
async function lockSchedule(tx: Pick<Database, "execute">) {
  await tx.execute(sql`select pg_advisory_xact_lock(7301)`);
}

function patternBy(slots: PatternSlot[]) {
  return slots.map(({ weekday, start, end }) => ({ weekday, start, end }));
}

function exceptionDetail(e: DateException) {
  return { closed: e.closed, note: e.note, slots: e.slots };
}

function conflictError(bookings: ReturnType<typeof findConflicts>) {
  return new ApiError(
    "SCHEDULE_CONFLICT",
    "Active bookings use slots this change removes.",
    { bookings },
  );
}

/** Refuses a single-date edit that would strand an active booking on that date. */
async function assertDateFree(
  tx: Pick<Database, "select">,
  finder: ActiveBookingFinder,
  now: Date,
  day: string,
  change: { before: ResolvedDay; after: ResolvedDay },
) {
  const unchanged = (d: string) => resolveDay(d, [], undefined);
  const conflicts = findConflicts(
    await finder(tx, now),
    (d) => (d === day ? change.before : unchanged(d)),
    (d) => (d === day ? change.after : unchanged(d)),
  );
  if (conflicts.length > 0) throw conflictError(conflicts);
}

export function createScheduleOperations(resolve: () => ScheduleDeps) {
  const deps = () => {
    const d = resolve();
    return { db: d.db, finder: d.activeBookings ?? noBookingsYet };
  };

  const getPattern = defineOperation({
    name: "staff.schedule.pattern.get",
    access: "owner",
    input: z.object({}),
    handler: async () => ({ slots: await loadPattern(deps().db) }),
  });

  const putPattern = defineOperation({
    name: "staff.schedule.pattern.update",
    access: "owner",
    input: patternInput,
    handler: async (input, ctx) => {
      const { db, finder } = deps();
      const actor = actorId(ctx.caller);
      const next: PatternSlot[] = [...input.slots].sort(
        (a, b) => a.weekday - b.weekday || compareSlots(a, b),
      );
      return db.transaction(async (tx) => {
        await lockSchedule(tx);
        const before = await loadPattern(tx);
        if (
          JSON.stringify(patternBy(before)) === JSON.stringify(patternBy(next))
        ) {
          return { slots: before };
        }

        const exceptions = new Map(
          (await loadExceptions(tx)).map((e) => [e.day, e]),
        );
        const conflicts = findConflicts(
          await finder(tx, ctx.clock.now()),
          (day) => resolveDay(day, before, exceptions.get(day)),
          (day) => resolveDay(day, next, exceptions.get(day)),
        );
        if (conflicts.length > 0) throw conflictError(conflicts);

        const now = ctx.clock.now();
        await tx.delete(slotPattern);
        if (next.length > 0) {
          await tx.insert(slotPattern).values(
            next.map((s) => ({
              weekday: s.weekday,
              startTime: s.start,
              endTime: s.end,
              createdAt: now,
              updatedAt: now,
            })),
          );
        }
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "schedule.pattern.update",
          target: "schedule:pattern",
          detail: { from: patternBy(before), to: patternBy(next) },
        });
        return { slots: await loadPattern(tx) };
      });
    },
  });

  const listExceptions = defineOperation({
    name: "staff.schedule.exceptions.list",
    access: "owner",
    input: z.object({
      from: dayField.optional(),
      to: dayField.optional(),
    }),
    handler: async (input, ctx) => ({
      // Dates already past are of no interest; the default starts today.
      exceptions: await loadExceptions(deps().db, {
        from: input.from ?? cairoDay(ctx.clock.now()),
        to: input.to,
      }),
    }),
  });

  const putException = defineOperation({
    name: "staff.schedule.exceptions.set",
    access: "owner",
    input: exceptionInput,
    handler: async (input, ctx) => {
      const { db, finder } = deps();
      const actor = actorId(ctx.caller);
      if (input.date < cairoDay(ctx.clock.now())) {
        throw new ApiError("VALIDATION_FAILED", "That date is in the past.", {
          issues: [
            {
              path: "date",
              code: "past_date",
              message: "Choose today or a later date.",
            },
          ],
        });
      }
      const next: DateException = {
        day: input.date,
        closed: input.closed,
        note: input.note,
        slots: [...input.slots].sort(compareSlots),
      };
      return db.transaction(async (tx) => {
        await lockSchedule(tx);
        const pattern = await loadPattern(tx);
        const [before] = await loadExceptions(tx, {
          from: input.date,
          to: input.date,
        });
        await assertDateFree(tx, finder, ctx.clock.now(), input.date, {
          before: resolveDay(input.date, pattern, before),
          after: resolveDay(input.date, pattern, next),
        });

        const now = ctx.clock.now();
        await tx.delete(dateException).where(eq(dateException.day, input.date));
        await tx.insert(dateException).values({
          day: input.date,
          closed: next.closed,
          note: next.note,
          createdAt: now,
          updatedAt: now,
        });
        if (next.slots.length > 0) {
          await tx.insert(exceptionSlot).values(
            next.slots.map((s) => ({
              day: input.date,
              startTime: s.start,
              endTime: s.end,
            })),
          );
        }
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: before
            ? "schedule.exception.update"
            : "schedule.exception.create",
          target: `schedule:date:${input.date}`,
          detail: {
            from: before ? exceptionDetail(before) : null,
            to: exceptionDetail(next),
          },
        });
        const [saved] = await loadExceptions(tx, {
          from: input.date,
          to: input.date,
        });
        if (!saved) throw new ApiError("INTERNAL");
        return saved;
      });
    },
  });

  const deleteException = defineOperation({
    name: "staff.schedule.exceptions.delete",
    access: "owner",
    input: z.object({ date: dayField }),
    handler: async (input, ctx) => {
      const { db, finder } = deps();
      const actor = actorId(ctx.caller);
      return db.transaction(async (tx) => {
        await lockSchedule(tx);
        const pattern = await loadPattern(tx);
        const [before] = await loadExceptions(tx, {
          from: input.date,
          to: input.date,
        });
        if (!before) {
          throw new ApiError("NOT_FOUND", "No exception on that date.");
        }
        await assertDateFree(tx, finder, ctx.clock.now(), input.date, {
          before: resolveDay(input.date, pattern, before),
          after: resolveDay(input.date, pattern, undefined),
        });
        await tx.delete(dateException).where(eq(dateException.day, input.date));
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "schedule.exception.delete",
          target: `schedule:date:${input.date}`,
          detail: { from: exceptionDetail(before) },
        });
        return { date: input.date };
      });
    },
  });

  return {
    getPattern,
    putPattern,
    listExceptions,
    putException,
    deleteException,
  };
}

export const scheduleOperations = createScheduleOperations(() => ({
  db: getDb(),
}));

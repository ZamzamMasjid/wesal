// Drizzle schema. Column-level detail lives here and in the migrations;
// entities and invariants are fixed in docs/architecture/data-model.md.
// Later sections add their tables (booking, outbox, ...) and re-export them here.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  bigint,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/**
 * Owner and staff. This is Better Auth's `user` table (ADR-004), so the
 * property names below are the ones Better Auth reads and writes. Staff sign in
 * with `username`; `email` is a synthetic internal address that Better Auth
 * requires but nobody uses (ADR-029). `active = false` is how an account is
 * disabled.
 */
export const staffUser = pgTable("staff_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["owner", "staff"] })
    .notNull()
    .default("staff"),
  notifyPhone: text("notify_phone"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

/** A signed-in browser. Managed by Better Auth. */
export const staffSession = pgTable(
  "staff_session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => staffUser.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("staff_session_user_id_idx").on(t.userId)],
);

/** The password credential of a staff user. Managed by Better Auth. */
export const staffAccount = pgTable(
  "staff_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => staffUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("staff_account_user_id_idx").on(t.userId)],
);

/** Short-lived tokens. Unused while there is no email flow; Better Auth expects it. */
export const staffVerification = pgTable("staff_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

/** What can be booked and its single price (whole EGP). */
export const occasion = pgTable("occasion", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  priceEgp: integer("price_egp").notNull(),
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

/**
 * The venue's booking rules and payment details. Always a single row (id 1,
 * enforced by a check constraint); read it with `loadSettings`, which creates
 * the row with these defaults the first time.
 */
export const settings = pgTable(
  "settings",
  {
    id: smallint("id").primaryKey().default(1),
    depositPercent: smallint("deposit_percent").notNull().default(50),
    holdMinutes: smallint("hold_minutes").notNull().default(20),
    /** A slot starting sooner than this cannot be held online. */
    nearSlotCutoffMinutes: integer("near_slot_cutoff_minutes")
      .notNull()
      .default(120),
    /** A hold on a slot starting within this many minutes is flagged urgent. */
    urgentThresholdMinutes: integer("urgent_threshold_minutes")
      .notNull()
      .default(1440),
    vodafoneCashNumber: text("vodafone_cash_number"),
    instapayAddress: text("instapay_address"),
    ...timestamps,
  },
  (t) => [
    check("settings_single_row", sql`${t.id} = 1`),
    check(
      "settings_deposit_percent_range",
      sql`${t.depositPercent} between 1 and 100`,
    ),
  ],
);

/** The default slots for a weekday (0 = Sunday ... 6 = Saturday), in Africa/Cairo wall-clock time. */
export const slotPattern = pgTable(
  "slot_pattern",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    ...timestamps,
  },
  (t) => [
    check("slot_pattern_weekday_range", sql`${t.weekday} between 0 and 6`),
    check("slot_pattern_ends_after_start", sql`${t.endTime} > ${t.startTime}`),
  ],
);

/**
 * A date whose slots differ from the weekly pattern: either closed, or replaced
 * by its own `exceptionSlot` rows. `day` is a Africa/Cairo calendar date.
 */
export const dateException = pgTable("date_exception", {
  day: date("day", { mode: "string" }).primaryKey(),
  closed: boolean("closed").notNull().default(false),
  note: text("note"),
  ...timestamps,
});

/** One of the custom slots of a date exception (empty when the date is closed). */
export const exceptionSlot = pgTable(
  "exception_slot",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    day: date("day", { mode: "string" })
      .notNull()
      .references(() => dateException.day, { onDelete: "cascade" }),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    index("exception_slot_day_idx").on(t.day),
    check(
      "exception_slot_ends_after_start",
      sql`${t.endTime} > ${t.startTime}`,
    ),
  ],
);

/**
 * Append-only record of staff actions (auth architecture, "Audit"). A database
 * trigger refuses UPDATE and DELETE, so rows are never edited or removed.
 * `bookingId` has no foreign key yet: the booking table arrives in phase 3,
 * which adds the constraint.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    actorId: text("actor_id")
      .notNull()
      .references(() => staffUser.id),
    /** A dotted verb, e.g. "staff.create", "staff.disable". */
    action: text("action").notNull(),
    /** What the action touched, e.g. "staff_user:abc", "setting:deposit". */
    target: text("target"),
    bookingId: integer("booking_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_booking_id_idx").on(t.bookingId),
    index("audit_log_at_idx").on(t.at),
  ],
);

// Drizzle schema. Column-level detail lives here and in the migrations;
// entities and invariants are fixed in docs/architecture/data-model.md.
// Later sections add their tables (booking, outbox, ...) and re-export them here.
import {
  boolean,
  index,
  integer,
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

/** The default slots for a weekday (0 = Sunday ... 6 = Saturday), in Africa/Cairo wall-clock time. */
export const slotPattern = pgTable("slot_pattern", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  weekday: smallint("weekday").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  ...timestamps,
});

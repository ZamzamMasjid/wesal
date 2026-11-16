// Drizzle schema. Column-level detail lives here and in the migrations;
// entities and invariants are fixed in docs/architecture/data-model.md.
// Later sections add their tables (booking, outbox, ...) and re-export them here.
import {
  boolean,
  integer,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/** Owner and staff. staff-access reshapes this for Better Auth (ADR-004). */
export const staffUser = pgTable(
  "staff_user",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    login: text("login").notNull(),
    role: text("role", { enum: ["owner", "staff"] }).notNull(),
    notifyPhone: text("notify_phone"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("staff_user_login_key").on(t.login)],
);

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

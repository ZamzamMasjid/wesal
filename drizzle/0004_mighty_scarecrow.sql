CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"deposit_percent" smallint DEFAULT 50 NOT NULL,
	"hold_minutes" smallint DEFAULT 20 NOT NULL,
	"near_slot_cutoff_minutes" integer DEFAULT 120 NOT NULL,
	"urgent_threshold_minutes" integer DEFAULT 1440 NOT NULL,
	"vodafone_cash_number" text,
	"instapay_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_deposit_percent_range" CHECK ("settings"."deposit_percent" between 1 and 100)
);

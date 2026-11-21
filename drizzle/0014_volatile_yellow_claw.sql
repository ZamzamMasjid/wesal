CREATE TABLE "slot_alert" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "slot_alert_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"phone" text NOT NULL,
	"locale" text NOT NULL,
	"token" text NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_alert_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "slot_alert_phone_slot_unique" ON "slot_alert" USING btree ("phone","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "slot_alert_slot_idx" ON "slot_alert" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "slot_alert_pending_idx" ON "slot_alert" USING btree ("notified_at","starts_at");
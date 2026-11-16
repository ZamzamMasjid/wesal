CREATE TABLE "outbox_message" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" integer,
	"recipient" text NOT NULL,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"values" jsonb NOT NULL,
	"locale" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"provider_message_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "outbox_message_due_idx" ON "outbox_message" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "outbox_message_provider_id_idx" ON "outbox_message" USING btree ("provider_message_id");
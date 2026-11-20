CREATE TABLE "booking" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"access_token" text NOT NULL,
	"occasion_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"source" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"locale" text NOT NULL,
	"price_egp" integer NOT NULL,
	"deposit_egp" integer NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"urgent" boolean DEFAULT false NOT NULL,
	"remainder_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "booking_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_occasion_id_occasion_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_starts_at_idx" ON "booking" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "booking_status_hold_expires_idx" ON "booking" USING btree ("status","hold_expires_at");
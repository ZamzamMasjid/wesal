CREATE TABLE "date_exception" (
	"day" date PRIMARY KEY NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exception_slot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exception_slot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "exception_slot_ends_after_start" CHECK ("exception_slot"."end_time" > "exception_slot"."start_time")
);
--> statement-breakpoint
ALTER TABLE "exception_slot" ADD CONSTRAINT "exception_slot_day_date_exception_day_fk" FOREIGN KEY ("day") REFERENCES "public"."date_exception"("day") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exception_slot_day_idx" ON "exception_slot" USING btree ("day");--> statement-breakpoint
ALTER TABLE "slot_pattern" ADD CONSTRAINT "slot_pattern_weekday_range" CHECK ("slot_pattern"."weekday" between 0 and 6);--> statement-breakpoint
ALTER TABLE "slot_pattern" ADD CONSTRAINT "slot_pattern_ends_after_start" CHECK ("slot_pattern"."end_time" > "slot_pattern"."start_time");
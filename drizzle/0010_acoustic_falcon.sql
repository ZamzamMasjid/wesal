CREATE TABLE "payment_proof" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_proof_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" integer NOT NULL,
	"file_path" text,
	"received_via" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_proof_booking_uploaded_idx" ON "payment_proof" USING btree ("booking_id","uploaded_at");--> statement-breakpoint
CREATE INDEX "payment_proof_purge_idx" ON "payment_proof" USING btree ("purged_at","uploaded_at");
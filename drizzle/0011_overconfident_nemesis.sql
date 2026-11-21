ALTER TABLE "staff_user" ADD COLUMN "notify_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_user" ADD COLUMN "locale" text DEFAULT 'ar' NOT NULL;
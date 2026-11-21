CREATE TABLE "media_asset" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_asset_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"alt_ar" text DEFAULT '' NOT NULL,
	"alt_en" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_asset_file_path_unique" UNIQUE("file_path")
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "max_photo_mb" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "max_video_mb" integer DEFAULT 200 NOT NULL;--> statement-breakpoint
CREATE INDEX "media_asset_position_idx" ON "media_asset" USING btree ("position","id");
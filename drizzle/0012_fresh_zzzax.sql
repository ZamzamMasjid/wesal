CREATE TABLE "site_content" (
	"key" text PRIMARY KEY NOT NULL,
	"value_ar" text DEFAULT '' NOT NULL,
	"value_en" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

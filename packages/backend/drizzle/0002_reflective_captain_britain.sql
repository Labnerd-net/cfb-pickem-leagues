CREATE TABLE "user"."notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"year" integer NOT NULL,
	"week_number" integer NOT NULL,
	"notification_type" text NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_unique" UNIQUE("user_id","year","week_number","notification_type","channel")
);
--> statement-breakpoint
CREATE TABLE "user"."notification_preferences" (
	"user_id" integer NOT NULL,
	"notification_type" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "notification_preferences_user_id_notification_type_channel_pk" PRIMARY KEY("user_id","notification_type","channel")
);
--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "email_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "email_verification_token" text;--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "email_verification_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "user"."users" ADD COLUMN "ntfy_server_url" text;--> statement-breakpoint
ALTER TABLE "user"."notification_log" ADD CONSTRAINT "notification_log_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("user_id") ON DELETE cascade ON UPDATE no action;
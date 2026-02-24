CREATE SCHEMA IF NOT EXISTS "admin";
CREATE SCHEMA IF NOT EXISTS "user";
CREATE TABLE "admin"."games" (
	"game_id" serial PRIMARY KEY NOT NULL,
	"cfbd_game_id" integer,
	"ncaa_game_id" text,
	"picked" boolean NOT NULL,
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"season_type" text NOT NULL,
	"completed" boolean NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_points" integer,
	"away_points" integer,
	"winning_team" text DEFAULT 'pending' NOT NULL,
	"start_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_natural_key" UNIQUE("year","week_number","home_team","away_team")
);
--> statement-breakpoint
CREATE TABLE "admin"."weeks" (
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"season_type" text NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "weeks_year_week_number_pk" PRIMARY KEY("year","week_number")
);
--> statement-breakpoint
CREATE TABLE "user"."deleted_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"roles" text[] NOT NULL,
	"created_at" timestamp NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user"."games" (
	"user_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"team_chosen" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
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
CREATE TABLE "user"."users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"roles" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email_verified" boolean DEFAULT false,
	"email_verification_token" text,
	"email_verification_sent_at" timestamp,
	"ntfy_server_url" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admin"."games" ADD CONSTRAINT "games_week_fk" FOREIGN KEY ("year","week_number") REFERENCES "admin"."weeks"("year","week_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."games" ADD CONSTRAINT "games_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."games" ADD CONSTRAINT "user_games_admin_games_fk" FOREIGN KEY ("game_id") REFERENCES "admin"."games"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."notification_log" ADD CONSTRAINT "notification_log_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_year_week_idx" ON "admin"."games" USING btree ("year","week_number");--> statement-breakpoint
CREATE INDEX "games_picked_idx" ON "admin"."games" USING btree ("picked");--> statement-breakpoint
CREATE INDEX "games_year_week_picked_idx" ON "admin"."games" USING btree ("year","week_number","picked");--> statement-breakpoint
CREATE INDEX "weeks_year_season_idx" ON "admin"."weeks" USING btree ("year","season_type");
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
	"home_points" integer DEFAULT -1 NOT NULL,
	"away_points" integer DEFAULT -1 NOT NULL,
	"winning_team" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "user"."games" (
	"user_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"cfbd_game_id" integer,
	"ncaa_game_id" text,
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"season_type" text NOT NULL,
	"completed" boolean NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_points" integer NOT NULL,
	"away_points" integer NOT NULL,
	"winning_team" text DEFAULT 'pending' NOT NULL,
	"team_chosen" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "user"."users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"roles" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admin"."games" ADD CONSTRAINT "games_week_fk" FOREIGN KEY ("year","week_number") REFERENCES "admin"."weeks"("year","week_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."games" ADD CONSTRAINT "games_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_year_week_idx" ON "admin"."games" USING btree ("year","week_number");--> statement-breakpoint
CREATE INDEX "games_picked_idx" ON "admin"."games" USING btree ("picked");--> statement-breakpoint
CREATE INDEX "games_year_week_picked_idx" ON "admin"."games" USING btree ("year","week_number","picked");--> statement-breakpoint
CREATE INDEX "weeks_year_season_idx" ON "admin"."weeks" USING btree ("year","season_type");--> statement-breakpoint
CREATE INDEX "user_games_year_week_idx" ON "user"."games" USING btree ("year","week_number");--> statement-breakpoint
CREATE INDEX "user_games_user_year_week_idx" ON "user"."games" USING btree ("user_id","year","week_number");
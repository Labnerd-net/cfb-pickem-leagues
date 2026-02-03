CREATE SCHEMA IF NOT EXISTS "admin";
CREATE SCHEMA IF NOT EXISTS "user";
CREATE TABLE "admin"."games" (
	"game_id" serial PRIMARY KEY NOT NULL,
	"week_id" integer NOT NULL,
	"picked" boolean NOT NULL,
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"season_type" text NOT NULL,
	"completed" boolean NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_points" integer,
	"away_points" integer,
	"winning_team" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin"."weeks" (
	"week_id" integer PRIMARY KEY NOT NULL,
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"season_type" text NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user"."games" (
	"game_id" integer PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"week_id" integer NOT NULL,
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"season_type" text NOT NULL,
	"completed" boolean NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_points" integer,
	"away_points" integer,
	"winning_team" text,
	"team_chosen" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user"."users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admin"."games" ADD CONSTRAINT "games_week_id_weeks_week_id_fk" FOREIGN KEY ("week_id") REFERENCES "admin"."weeks"("week_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."games" ADD CONSTRAINT "games_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("user_id") ON DELETE no action ON UPDATE no action;
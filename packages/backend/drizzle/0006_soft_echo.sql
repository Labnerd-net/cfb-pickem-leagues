CREATE TABLE "admin"."score_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"corrected_by" integer NOT NULL,
	"corrected_at" timestamp DEFAULT now() NOT NULL,
	"old_home_points" integer,
	"old_away_points" integer,
	"new_home_points" integer NOT NULL,
	"new_away_points" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin"."score_corrections" ADD CONSTRAINT "score_corrections_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "admin"."games"("game_id") ON DELETE cascade ON UPDATE no action;
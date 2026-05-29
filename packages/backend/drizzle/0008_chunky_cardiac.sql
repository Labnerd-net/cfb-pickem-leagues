DROP INDEX "admin"."games_picked_idx";--> statement-breakpoint
DROP INDEX "admin"."games_year_week_picked_idx";--> statement-breakpoint
ALTER TABLE "user"."games" DROP CONSTRAINT "games_user_id_game_id_pk";--> statement-breakpoint
ALTER TABLE "user"."games" ADD COLUMN "league_id" integer;--> statement-breakpoint
UPDATE "user"."games" SET "league_id" = (SELECT "league_id" FROM "leagues" WHERE "name" = 'Default League' LIMIT 1);--> statement-breakpoint
ALTER TABLE "user"."games" ALTER COLUMN "league_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user"."games" ADD CONSTRAINT "games_league_id_leagues_league_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("league_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."games" ADD CONSTRAINT "games_user_id_game_id_league_id_pk" PRIMARY KEY("user_id","game_id","league_id");--> statement-breakpoint
ALTER TABLE "admin"."games" DROP COLUMN "picked";

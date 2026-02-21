DROP INDEX "user"."user_games_year_week_idx";--> statement-breakpoint
DROP INDEX "user"."user_games_user_year_week_idx";--> statement-breakpoint
ALTER TABLE "user"."games" ADD CONSTRAINT "user_games_admin_games_fk" FOREIGN KEY ("game_id") REFERENCES "admin"."games"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "cfbd_game_id";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "ncaa_game_id";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "week_number";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "year";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "season_type";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "completed";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "home_team";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "away_team";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "home_points";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "away_points";--> statement-breakpoint
ALTER TABLE "user"."games" DROP COLUMN "winning_team";
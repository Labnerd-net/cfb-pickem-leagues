ALTER TABLE "user"."games" DROP CONSTRAINT "user_games_admin_games_fk";
--> statement-breakpoint
ALTER TABLE "user"."games" ADD CONSTRAINT "user_games_admin_games_fk" FOREIGN KEY ("game_id") REFERENCES "admin"."games"("game_id") ON DELETE restrict ON UPDATE no action;
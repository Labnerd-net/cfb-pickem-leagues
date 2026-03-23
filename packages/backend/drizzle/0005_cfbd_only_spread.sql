ALTER TABLE "admin"."games" DROP COLUMN "ncaa_game_id";
--> statement-breakpoint
ALTER TABLE "admin"."games" ADD COLUMN "spread" real;

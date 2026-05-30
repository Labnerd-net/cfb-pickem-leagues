ALTER TABLE "user"."notification_log" DROP CONSTRAINT "notification_log_unique";--> statement-breakpoint
ALTER TABLE "user"."notification_log" ADD COLUMN "league_id" integer;--> statement-breakpoint
UPDATE "user"."notification_log" SET "league_id" = 0 WHERE "user_id" = 0;--> statement-breakpoint
UPDATE "user"."notification_log" SET "league_id" = 1 WHERE "user_id" != 0;--> statement-breakpoint
ALTER TABLE "user"."notification_log" ALTER COLUMN "league_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user"."notification_log" ADD CONSTRAINT "notification_log_unique" UNIQUE("user_id","league_id","year","week_number","notification_type","channel");

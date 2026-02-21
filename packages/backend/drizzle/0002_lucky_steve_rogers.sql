ALTER TABLE "admin"."games" ALTER COLUMN "home_points" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "admin"."games" ALTER COLUMN "home_points" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin"."games" ALTER COLUMN "away_points" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "admin"."games" ALTER COLUMN "away_points" DROP NOT NULL;
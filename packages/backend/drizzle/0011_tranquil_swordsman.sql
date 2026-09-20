ALTER TABLE "leagues" DROP CONSTRAINT "leagues_created_by_users_user_id_fk";
--> statement-breakpoint
ALTER TABLE "leagues" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"."users"("user_id") ON DELETE set null ON UPDATE no action;
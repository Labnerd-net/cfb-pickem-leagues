ALTER TABLE "user"."notification_log" DROP CONSTRAINT IF EXISTS "notification_log_user_id_users_user_id_fk";--> statement-breakpoint
ALTER TABLE "user"."users" DROP COLUMN IF EXISTS "ntfy_server_url";
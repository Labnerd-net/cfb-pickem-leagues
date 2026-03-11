CREATE INDEX IF NOT EXISTS "notification_log_sent_at_idx" ON "user"."notification_log" USING btree ("sent_at");

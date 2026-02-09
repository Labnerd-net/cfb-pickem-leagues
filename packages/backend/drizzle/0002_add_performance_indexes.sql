-- Add indexes for improved query performance

-- Admin schema indexes
CREATE INDEX IF NOT EXISTS "weeks_week_number_idx" ON "admin"."weeks" USING btree ("week_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weeks_year_season_idx" ON "admin"."weeks" USING btree ("year","season_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_week_id_idx" ON "admin"."games" USING btree ("week_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_picked_idx" ON "admin"."games" USING btree ("picked");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_week_id_picked_idx" ON "admin"."games" USING btree ("week_id","picked");--> statement-breakpoint

-- User schema indexes
CREATE INDEX IF NOT EXISTS "user_games_week_id_idx" ON "user"."games" USING btree ("week_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_games_user_id_week_id_idx" ON "user"."games" USING btree ("user_id","week_id");

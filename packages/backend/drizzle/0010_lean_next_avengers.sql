CREATE TABLE "league_channels" (
	"league_id" integer PRIMARY KEY NOT NULL,
	"ntfy_topic_url" text,
	"telegram_bot_token" text,
	"telegram_chat_id" text,
	"telegram_invite_url" text,
	"discord_webhook_url" text,
	"discord_invite_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_channels" ADD CONSTRAINT "league_channels_league_id_leagues_league_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("league_id") ON DELETE no action ON UPDATE no action;
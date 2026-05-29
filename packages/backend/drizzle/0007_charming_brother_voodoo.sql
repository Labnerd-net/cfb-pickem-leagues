CREATE TABLE "league_games" (
	"league_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_games_league_id_game_id_pk" PRIMARY KEY("league_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"league_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_members_league_id_user_id_pk" PRIMARY KEY("league_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"league_id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "league_games" ADD CONSTRAINT "league_games_league_id_leagues_league_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("league_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_games" ADD CONSTRAINT "league_games_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "admin"."games"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_league_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("league_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"."users"("user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "leagues" ("name", "invite_code", "created_by")
SELECT 'Default League', 'default00', u.user_id
FROM "user"."users" u
WHERE 'admin' = ANY(u.roles)
ORDER BY u.user_id ASC
LIMIT 1;
--> statement-breakpoint
INSERT INTO "league_members" ("league_id", "user_id", "role")
SELECT
  (SELECT league_id FROM leagues LIMIT 1),
  u.user_id,
  CASE WHEN 'admin' = ANY(u.roles) THEN 'admin' ELSE 'member' END
FROM "user"."users" u;
--> statement-breakpoint
INSERT INTO "league_games" ("league_id", "game_id")
SELECT
  (SELECT league_id FROM leagues LIMIT 1),
  g.game_id
FROM "admin"."games" g
WHERE g.picked = true;
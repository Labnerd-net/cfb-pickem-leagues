-- Drop old single-column primary key on game_id
ALTER TABLE "user"."games" DROP CONSTRAINT "games_pkey";--> statement-breakpoint

-- Add composite primary key on (user_id, game_id)
ALTER TABLE "user"."games" ADD CONSTRAINT "games_user_id_game_id_pk" PRIMARY KEY("user_id","game_id");
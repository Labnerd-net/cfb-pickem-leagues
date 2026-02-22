CREATE TABLE "user"."deleted_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"roles" text[] NOT NULL,
	"created_at" timestamp NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);

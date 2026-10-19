CREATE TABLE "guest_order_throttles" (
	"branch_id" uuid NOT NULL,
	"phone_hash" text NOT NULL,
	"last_order_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_order_throttles_branch_id_phone_hash_pk" PRIMARY KEY("branch_id","phone_hash")
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "qr_token" text;--> statement-breakpoint
UPDATE "branches" SET "qr_token" = replace(gen_random_uuid()::text, '-', '') WHERE "qr_token" IS NULL;--> statement-breakpoint
ALTER TABLE "branches" ALTER COLUMN "qr_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_order_throttles" ADD CONSTRAINT "guest_order_throttles_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_order_throttles_last_idx" ON "guest_order_throttles" USING btree ("last_order_at");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_qr_token_unique" UNIQUE("qr_token");
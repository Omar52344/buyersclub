CREATE TYPE "public"."branch_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('draft', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."file_bucket" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_type" AS ENUM('delivery', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'awaiting_payment', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer', 'card_terminal', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'evidence_submitted', 'validated', 'rejected', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('buyer', 'vendor_owner', 'vendor_staff', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."verification_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."verification_purpose" AS ENUM('signup', 'login', 'verify_email', 'verify_phone', 'reset');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"recipient_name" text,
	"phone" text,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"business_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_hour_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "branch_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "branch_hours_weekday_check" CHECK ("branch_hours"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "branch_products" (
	"branch_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_cents" bigint,
	"stock" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	CONSTRAINT "branch_products_branch_id_product_id_pk" PRIMARY KEY("branch_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address_line" text NOT NULL,
	"city" text NOT NULL,
	"region" text,
	"country" text DEFAULT 'CO' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"manual_open" boolean DEFAULT false NOT NULL,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"delivery_enabled" boolean DEFAULT true NOT NULL,
	"delivery_fee_cents" bigint DEFAULT 0 NOT NULL,
	"min_order_cents" bigint DEFAULT 0 NOT NULL,
	"prep_time_minutes" integer DEFAULT 20 NOT NULL,
	"delivery_eta_minutes" integer DEFAULT 20 NOT NULL,
	"status" "branch_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"branch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_file_id" uuid,
	"category_id" uuid,
	"tax_id" text,
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"status" "business_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "businesses_currency_check" CHECK ("businesses"."currency" in ('COP','USD'))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"buyer_last_read_at" timestamp with time zone,
	"vendor_last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expo_push_token" text NOT NULL,
	"platform" text NOT NULL,
	"app_version" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_expo_push_token_unique" UNIQUE("expo_push_token")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"bucket" "file_bucket" NOT NULL,
	"key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"sha256" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"qty" integer NOT NULL,
	"line_total_cents" bigint NOT NULL,
	"notes" text,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"fulfillment" "fulfillment_type" NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"delivery_fee_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) NOT NULL,
	"buyer_name" text,
	"buyer_phone" text,
	"delivery_address_id" uuid,
	"delivery_address_snapshot" jsonb,
	"notes" text,
	"eta_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_code_unique" UNIQUE("code"),
	CONSTRAINT "orders_currency_check" CHECK ("orders"."currency" in ('COP','USD'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"evidence_file_id" uuid,
	"evidence_note" text,
	"submitted_at" timestamp with time zone,
	"validated_by_user_id" uuid,
	"validated_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_currency_check" CHECK ("payments"."currency" in ('COP','USD'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"image_file_id" uuid,
	"base_price_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"sku" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_currency_check" CHECK ("products"."currency" in ('COP','USD')),
	CONSTRAINT "products_price_check" CHECK ("products"."base_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_name" text,
	"platform" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"business_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone" text NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"phone_verification_method" text,
	"full_name" text,
	"avatar_file_id" uuid,
	"locale" text DEFAULT 'es' NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"channel" "verification_channel" NOT NULL,
	"destination" text NOT NULL,
	"purpose" "verification_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_hour_exceptions" ADD CONSTRAINT "branch_hour_exceptions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_hours" ADD CONSTRAINT "branch_hours_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_evidence_file_id_files_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_business_idx" ON "audit_log" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "branch_hour_exceptions_branch_idx" ON "branch_hour_exceptions" USING btree ("branch_id","date");--> statement-breakpoint
CREATE INDEX "branch_hours_branch_idx" ON "branch_hours" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_products_product_idx" ON "branch_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "branches_business_idx" ON "branches" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "branches_city_idx" ON "branches" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "business_members_unique_idx" ON "business_members" USING btree ("business_id","user_id");--> statement-breakpoint
CREATE INDEX "business_members_user_idx" ON "business_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "businesses_owner_idx" ON "businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "conversations_business_idx" ON "conversations" USING btree ("business_id","last_message_at");--> statement-breakpoint
CREATE INDEX "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_events_order_idx" ON "order_status_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_branch_status_idx" ON "orders" USING btree ("branch_id","status","created_at");--> statement-breakpoint
CREATE INDEX "orders_buyer_idx" ON "orders" USING btree ("buyer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_business_idx" ON "orders" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "products_business_idx" ON "products" USING btree ("business_id","is_active");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_unique_idx" ON "user_roles" USING btree ("user_id","role","business_id");--> statement-breakpoint
CREATE INDEX "user_roles_business_idx" ON "user_roles" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "verifications_destination_idx" ON "verifications" USING btree ("destination","purpose","created_at");--> statement-breakpoint
CREATE INDEX "verifications_user_idx" ON "verifications" USING btree ("user_id");
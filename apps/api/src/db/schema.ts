import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'blocked']);
export const userRoleEnum = pgEnum('user_role', ['buyer', 'vendor_owner', 'vendor_staff', 'admin']);
export const verificationChannelEnum = pgEnum('verification_channel', ['email', 'sms']);
export const verificationPurposeEnum = pgEnum('verification_purpose', [
  'signup',
  'login',
  'verify_email',
  'verify_phone',
  'reset',
]);
export const businessStatusEnum = pgEnum('business_status', ['draft', 'active', 'suspended']);
export const memberRoleEnum = pgEnum('member_role', ['owner', 'staff']);
export const branchStatusEnum = pgEnum('branch_status', ['active', 'paused', 'closed']);
export const fulfillmentEnum = pgEnum('fulfillment_type', ['delivery', 'pickup']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'awaiting_payment',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
  'rejected',
]);
export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'transfer',
  'card_terminal',
  'other',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'evidence_submitted',
  'validated',
  'rejected',
  'refunded',
]);
export const fileBucketEnum = pgEnum('file_bucket', ['public', 'private']);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const id = () => uuid('id').primaryKey().defaultRandom();

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Identidad                                                           */
/* ------------------------------------------------------------------ */

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  phone: text('phone').notNull().unique(),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  phoneVerificationMethod: text('phone_verification_method'),
  passwordHash: text('password_hash'),
  fullName: text('full_name'),
  avatarFileId: uuid('avatar_file_id'),
  locale: text('locale').notNull().default('es'),
  status: userStatusEnum('status').notNull().default('pending'),
  ...timestamps(),
});

export const verifications = pgTable(
  'verifications',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    channel: verificationChannelEnum('channel').notNull(),
    destination: text('destination').notNull(),
    purpose: verificationPurposeEnum('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('verifications_destination_idx').on(table.destination, table.purpose, table.createdAt),
    index('verifications_user_idx').on(table.userId),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    deviceName: text('device_name'),
    platform: text('platform'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('refresh_tokens_user_idx').on(table.userId)],
);

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expoPushToken: text('expo_push_token').notNull().unique(),
    platform: text('platform').notNull(),
    appVersion: text('app_version'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('device_tokens_user_idx').on(table.userId)],
);

export const categories = pgTable('categories', {
  id: id(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const files = pgTable(
  'files',
  {
    id: id(),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    bucket: fileBucketEnum('bucket').notNull(),
    key: text('key').notNull().unique(),
    mime: text('mime').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    sha256: text('sha256'),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('files_owner_idx').on(table.ownerUserId)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
    businessId: uuid('business_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_roles_unique_idx').on(table.userId, table.role, table.businessId),
    index('user_roles_business_idx').on(table.businessId),
  ],
);

/* ------------------------------------------------------------------ */
/* Negocio y sucursales                                                */
/* ------------------------------------------------------------------ */

export const businesses = pgTable(
  'businesses',
  {
    id: id(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    logoFileId: uuid('logo_file_id').references(() => files.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    taxId: text('tax_id'),
    currency: char('currency', { length: 3 }).notNull().default('COP'),
    status: businessStatusEnum('status').notNull().default('draft'),
    ...timestamps(),
  },
  (table) => [
    index('businesses_owner_idx').on(table.ownerUserId),
    check('businesses_currency_check', sql`${table.currency} in ('COP','USD')`),
  ],
);

export const branches = pgTable(
  'branches',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    addressLine: text('address_line').notNull(),
    city: text('city').notNull(),
    region: text('region'),
    country: text('country').notNull().default('CO'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    timezone: text('timezone').notNull().default('America/Bogota'),
    manualOpen: boolean('manual_open').notNull().default(false),
    pickupEnabled: boolean('pickup_enabled').notNull().default(true),
    deliveryEnabled: boolean('delivery_enabled').notNull().default(true),
    deliveryFeeCents: bigint('delivery_fee_cents', { mode: 'number' }).notNull().default(0),
    minOrderCents: bigint('min_order_cents', { mode: 'number' }).notNull().default(0),
    prepTimeMinutes: integer('prep_time_minutes').notNull().default(20),
    deliveryEtaMinutes: integer('delivery_eta_minutes').notNull().default(20),
    status: branchStatusEnum('status').notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    index('branches_business_idx').on(table.businessId),
    index('branches_city_idx').on(table.city),
  ],
);

export const businessMembers = pgTable(
  'business_members',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull(),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('business_members_unique_idx').on(table.businessId, table.userId),
    index('business_members_user_idx').on(table.userId),
  ],
);

export const branchHours = pgTable(
  'branch_hours',
  {
    id: id(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    opensAt: time('opens_at').notNull(),
    closesAt: time('closes_at').notNull(),
    isClosed: boolean('is_closed').notNull().default(false),
  },
  (table) => [
    index('branch_hours_branch_idx').on(table.branchId),
    check('branch_hours_weekday_check', sql`${table.weekday} between 0 and 6`),
  ],
);

export const branchHourExceptions = pgTable(
  'branch_hour_exceptions',
  {
    id: id(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    isClosed: boolean('is_closed').notNull().default(false),
    opensAt: time('opens_at'),
    closesAt: time('closes_at'),
    note: text('note'),
  },
  (table) => [index('branch_hour_exceptions_branch_idx').on(table.branchId, table.date)],
);

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

export const products = pgTable(
  'products',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    imageFileId: uuid('image_file_id').references(() => files.id, { onDelete: 'set null' }),
    basePriceCents: bigint('base_price_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('COP'),
    sku: text('sku'),
    isActive: boolean('is_active').notNull().default(true),
    shareWithAllBranches: boolean('share_with_all_branches').notNull().default(true),
    attributes: jsonb('attributes').notNull().default(sql`'{}'::jsonb`),
    ...timestamps(),
  },
  (table) => [
    index('products_business_idx').on(table.businessId, table.isActive),
    check('products_currency_check', sql`${table.currency} in ('COP','USD')`),
    check('products_price_check', sql`${table.basePriceCents} >= 0`),
  ],
);

export const branchProducts = pgTable(
  'branch_products',
  {
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    priceCents: bigint('price_cents', { mode: 'number' }),
    stock: integer('stock'),
    isAvailable: boolean('is_available').notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.branchId, table.productId] }),
    index('branch_products_product_idx').on(table.productId),
  ],
);

/* ------------------------------------------------------------------ */
/* Direcciones y pedidos                                               */
/* ------------------------------------------------------------------ */

export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label'),
    recipientName: text('recipient_name'),
    phone: text('phone'),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('addresses_user_idx').on(table.userId)],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    code: text('code').notNull().unique(),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    fulfillment: fulfillmentEnum('fulfillment').notNull(),
    status: orderStatusEnum('status').notNull().default('pending'),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull().default(0),
    deliveryFeeCents: bigint('delivery_fee_cents', { mode: 'number' }).notNull().default(0),
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull().default(0),
    totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
    currency: char('currency', { length: 3 }).notNull(),
    buyerName: text('buyer_name'),
    buyerPhone: text('buyer_phone'),
    deliveryAddressId: uuid('delivery_address_id').references(() => addresses.id, {
      onDelete: 'set null',
    }),
    deliveryAddressSnapshot: jsonb('delivery_address_snapshot'),
    notes: text('notes'),
    etaAt: timestamp('eta_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    ...timestamps(),
  },
  (table) => [
    index('orders_branch_status_idx').on(table.branchId, table.status, table.createdAt),
    index('orders_buyer_idx').on(table.buyerUserId, table.createdAt),
    index('orders_business_idx').on(table.businessId, table.createdAt),
    check('orders_currency_check', sql`${table.currency} in ('COP','USD')`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    nameSnapshot: text('name_snapshot').notNull(),
    unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
    qty: integer('qty').notNull(),
    lineTotalCents: bigint('line_total_cents', { mode: 'number' }).notNull(),
    notes: text('notes'),
    options: jsonb('options').notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [index('order_items_order_idx').on(table.orderId)],
);

export const orderStatusEvents = pgTable(
  'order_status_events',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum('from_status'),
    toStatus: orderStatusEnum('to_status').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('order_status_events_order_idx').on(table.orderId, table.createdAt)],
);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    method: paymentMethodEnum('method').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    evidenceFileId: uuid('evidence_file_id').references(() => files.id, { onDelete: 'set null' }),
    evidenceNote: text('evidence_note'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    validatedByUserId: uuid('validated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    ...timestamps(),
  },
  (table) => [
    index('payments_order_idx').on(table.orderId),
    check('payments_currency_check', sql`${table.currency} in ('COP','USD')`),
  ],
);

/* ------------------------------------------------------------------ */
/* Chat, notificaciones y auditoría                                    */
/* ------------------------------------------------------------------ */

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: 'cascade' }),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    buyerLastReadAt: timestamp('buyer_last_read_at', { withTimezone: true }),
    vendorLastReadAt: timestamp('vendor_last_read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('conversations_business_idx').on(table.businessId, table.lastMessageAt)],
);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body'),
    fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('messages_conversation_idx').on(table.conversationId, table.createdAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.createdAt)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_business_idx').on(table.businessId, table.createdAt)],
);

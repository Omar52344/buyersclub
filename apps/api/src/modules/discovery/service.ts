import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  computeOpenStatus,
  type OpenStatus,
  type ScheduleException,
  type ScheduleRange,
} from '@buyersclub/core';
import { db } from '../../db/index';
import {
  branchHourExceptions,
  branchHours,
  branchProducts,
  branches,
  businesses,
  categories,
  products,
} from '../../db/schema';
import { AppError } from '../../errors';

interface NearbyRow {
  id: string;
  name: string;
  address_line: string;
  city: string;
  lat: number;
  lng: number;
  manual_open: boolean;
  status: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee_cents: string | number;
  min_order_cents: string | number;
  timezone: string;
  business_id: string;
  business_name: string;
  currency: string;
  category_id: string | null;
  category_name: string | null;
  distance_m: number;
}

export interface NearbyQuery {
  lat: number;
  lng: number;
  radius: number;
  categoryId?: string;
  fulfillment?: 'delivery' | 'pickup';
  q?: string;
  openNow: boolean;
  limit: number;
}

export interface BranchProductPreview {
  name: string;
  priceCents: number;
}

export interface NearbyBranch {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  location: { lat: number; lng: number };
  distanceMeters: number;
  isOpen: boolean;
  openReason: OpenStatus['reason'];
  business: { id: string; name: string; currency: string };
  category: { id: string; name: string } | null;
  fulfillment: { delivery: boolean; pickup: boolean };
  deliveryFee: { amountCents: number; currency: string };
  minOrder: { amountCents: number; currency: string };
  productPreview: BranchProductPreview[];
}

async function loadSchedules(branchIds: string[]) {
  if (branchIds.length === 0) {
    return { hours: [], exceptions: [] };
  }
  const [hours, exceptions] = await Promise.all([
    db.select().from(branchHours).where(inArray(branchHours.branchId, branchIds)),
    db
      .select()
      .from(branchHourExceptions)
      .where(inArray(branchHourExceptions.branchId, branchIds)),
  ]);
  return { hours, exceptions };
}

function toSchedule(hours: readonly { opensAt: string; closesAt: string; weekday: number; isClosed: boolean }[]): ScheduleRange[] {
  return hours.map((hour) => ({
    weekday: hour.weekday,
    opensAt: hour.opensAt,
    closesAt: hour.closesAt,
    isClosed: hour.isClosed,
  }));
}

function toExceptions(
  exceptions: readonly {
    date: string;
    isClosed: boolean;
    opensAt: string | null;
    closesAt: string | null;
  }[],
): ScheduleException[] {
  return exceptions.map((exception) => ({
    date: exception.date,
    isClosed: exception.isClosed,
    opensAt: exception.opensAt,
    closesAt: exception.closesAt,
  }));
}

export async function findNearbyBranches(input: NearbyQuery): Promise<NearbyBranch[]> {
  const conditions = [
    sql`b.status = 'active'`,
    sql`bz.status = 'active'`,
    sql`b.location is not null`,
    sql`ST_DWithin(b.location, ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography, ${input.radius})`,
  ];
  if (input.categoryId) {
    conditions.push(sql`c.id = ${input.categoryId}`);
  }
  if (input.fulfillment === 'delivery') {
    conditions.push(sql`b.delivery_enabled = true`);
  }
  if (input.fulfillment === 'pickup') {
    conditions.push(sql`b.pickup_enabled = true`);
  }
  if (input.q) {
    const pattern = `%${input.q}%`;
    conditions.push(sql`(b.name ilike ${pattern} or bz.name ilike ${pattern})`);
  }

  const where = sql.join(conditions, sql` and `);
  const query = sql`
    select b.id, b.name, b.address_line, b.city, b.lat, b.lng,
           b.manual_open, b.status, b.delivery_enabled, b.pickup_enabled,
           b.delivery_fee_cents, b.min_order_cents, b.timezone,
           bz.id as business_id, bz.name as business_name, bz.currency,
           c.id as category_id, c.name as category_name,
           ST_Distance(b.location, ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography) as distance_m
    from branches b
    join businesses bz on bz.id = b.business_id
    left join categories c on c.id = bz.category_id
    where ${where}
    order by distance_m asc
    limit 200
  `;

  const result = await db.execute(query);
  const rows = result as unknown as NearbyRow[];
  const ids = rows.map((row) => row.id);
  const { hours, exceptions } = await loadSchedules(ids);

  const previews = ids.length
    ? await db
        .select({
          branchId: branchProducts.branchId,
          name: products.name,
          priceCents: sql<number>`coalesce(${branchProducts.priceCents}, ${products.basePriceCents})`,
        })
        .from(branchProducts)
        .innerJoin(products, eq(branchProducts.productId, products.id))
        .where(
          and(
            inArray(branchProducts.branchId, ids),
            eq(products.isActive, true),
            eq(branchProducts.isAvailable, true),
          ),
        )
        .limit(500)
    : [];

  const now = new Date();
  const items: NearbyBranch[] = rows.map((row) => {
    const branchSchedule = hours.filter((hour) => hour.branchId === row.id);
    const branchExceptions = exceptions.filter((exception) => exception.branchId === row.id);
    const status = computeOpenStatus({
      at: now,
      timeZone: row.timezone,
      status: row.status,
      manualOpen: row.manual_open,
      hours: toSchedule(branchSchedule),
      exceptions: toExceptions(branchExceptions),
    });

    const preview = previews
      .filter((item) => item.branchId === row.id)
      .slice(0, 3)
      .map((item) => ({ name: item.name, priceCents: Number(item.priceCents) }));

    return {
      id: row.id,
      name: row.name,
      addressLine: row.address_line,
      city: row.city,
      location: { lat: row.lat, lng: row.lng },
      distanceMeters: Math.round(row.distance_m),
      isOpen: status.isOpen,
      openReason: status.reason,
      business: {
        id: row.business_id,
        name: row.business_name,
        currency: row.currency,
      },
      category: row.category_id
        ? { id: row.category_id, name: row.category_name ?? 'Sin categoría' }
        : null,
      fulfillment: { delivery: row.delivery_enabled, pickup: row.pickup_enabled },
      deliveryFee: {
        amountCents: Number(row.delivery_fee_cents),
        currency: row.currency,
      },
      minOrder: { amountCents: Number(row.min_order_cents), currency: row.currency },
      productPreview: preview,
    };
  });

  const filtered = input.openNow ? items.filter((item) => item.isOpen) : items;
  return filtered.slice(0, input.limit);
}

export interface PublicBranch {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  region: string | null;
  location: { lat: number; lng: number };
  phone: string | null;
  timezone: string;
  isOpen: boolean;
  openReason: OpenStatus['reason'];
  localTime: string;
  business: {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    slug: string;
  };
  category: { id: string; name: string } | null;
  fulfillment: { delivery: boolean; pickup: boolean };
  deliveryFee: { amountCents: number; currency: string };
  minOrder: { amountCents: number; currency: string };
  prepTimeMinutes: number;
  etaMinutes: number;
  hours: ScheduleRange[];
  exceptions: ScheduleException[];
  products: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    currency: string;
    stock: number | null;
    isAvailable: boolean;
  }[];
}

export async function getPublicBranch(branchId: string): Promise<PublicBranch> {
  const [row] = await db
    .select({
      id: branches.id,
      name: branches.name,
      addressLine: branches.addressLine,
      city: branches.city,
      region: branches.region,
      lat: branches.lat,
      lng: branches.lng,
      phone: branches.phone,
      timezone: branches.timezone,
      status: branches.status,
      manualOpen: branches.manualOpen,
      deliveryEnabled: branches.deliveryEnabled,
      pickupEnabled: branches.pickupEnabled,
      deliveryFeeCents: branches.deliveryFeeCents,
      minOrderCents: branches.minOrderCents,
      prepTimeMinutes: branches.prepTimeMinutes,
      deliveryEtaMinutes: branches.deliveryEtaMinutes,
      businessId: businesses.id,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      businessDescription: businesses.description,
      currency: businesses.currency,
      categoryId: categories.id,
      categoryName: categories.name,
    })
    .from(branches)
    .innerJoin(businesses, eq(branches.businessId, businesses.id))
    .leftJoin(categories, eq(businesses.categoryId, categories.id))
    .where(eq(branches.id, branchId))
    .limit(1);

  if (!row || row.status !== 'active') {
    throw new AppError('BRANCH_NOT_FOUND', 'La sucursal no existe o no está disponible.', 404);
  }

  const [hours, exceptions, productRows] = await Promise.all([
    db.select().from(branchHours).where(eq(branchHours.branchId, branchId)),
    db
      .select()
      .from(branchHourExceptions)
      .where(eq(branchHourExceptions.branchId, branchId)),
    db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        priceCents: sql<number>`coalesce(${branchProducts.priceCents}, ${products.basePriceCents})`,
        currency: products.currency,
        stock: branchProducts.stock,
        isAvailable: branchProducts.isAvailable,
      })
      .from(branchProducts)
      .innerJoin(products, eq(branchProducts.productId, products.id))
      .where(
        and(
          eq(branchProducts.branchId, branchId),
          eq(products.isActive, true),
          eq(branchProducts.isAvailable, true),
          sql`(${branchProducts.stock} is null or ${branchProducts.stock} > 0)`,
        ),
      )
      .orderBy(products.name),
  ]);

  const status = computeOpenStatus({
    at: new Date(),
    timeZone: row.timezone,
    status: row.status,
    manualOpen: row.manualOpen,
    hours: toSchedule(hours),
    exceptions: toExceptions(exceptions),
  });

  return {
    id: row.id,
    name: row.name,
    addressLine: row.addressLine,
    city: row.city,
    region: row.region,
    location: { lat: row.lat, lng: row.lng },
    phone: row.phone,
    timezone: row.timezone,
    isOpen: status.isOpen,
    openReason: status.reason,
    localTime: status.localTime,
    business: {
      id: row.businessId,
      name: row.businessName,
      description: row.businessDescription,
      currency: row.currency,
      slug: row.businessSlug,
    },
    category: row.categoryId
      ? { id: row.categoryId, name: row.categoryName ?? 'Sin categoría' }
      : null,
    fulfillment: { delivery: row.deliveryEnabled, pickup: row.pickupEnabled },
    deliveryFee: {
      amountCents: Number(row.deliveryFeeCents),
      currency: row.currency,
    },
    minOrder: {
      amountCents: Number(row.minOrderCents),
      currency: row.currency,
    },
    prepTimeMinutes: row.prepTimeMinutes,
    etaMinutes: row.deliveryEtaMinutes,
    hours: toSchedule(hours),
    exceptions: toExceptions(exceptions),
    products: productRows.map((product) => ({
      ...product,
      priceCents: Number(product.priceCents),
    })),
  };
}

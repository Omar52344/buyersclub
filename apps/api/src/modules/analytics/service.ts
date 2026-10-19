import { and, eq, gte, inArray, lt, or } from 'drizzle-orm';
import { getLocalParts, ORDER_STATUSES, type OrderStatus } from '@buyersclub/core';
import { db } from '../../db/index';
import { branches, businesses, orderItems, orders } from '../../db/schema';
import { AppError } from '../../errors';
import { config } from '../../config';
import { addDays, zonedDayStart } from '../../lib/timezone';
import { assertBusinessOwner } from '../businesses/service';

export type Granularity = 'day' | 'week' | 'month';

export interface AnalyticsRange {
  from: string;
  to: string;
  granularity: Granularity;
}

function bucketFor(date: Date, timeZone: string, granularity: Granularity): string {
  const local = getLocalParts(date, timeZone).date;
  if (granularity === 'month') {
    return local.slice(0, 7);
  }
  if (granularity === 'week') {
    const [year, month, day] = local.split('-').map(Number) as [number, number, number];
    const value = new Date(Date.UTC(year, month - 1, day));
    const weekday = (value.getUTCDay() + 6) % 7;
    value.setUTCDate(value.getUTCDate() - weekday);
    return value.toISOString().slice(0, 10);
  }
  return local;
}

function rangeBounds(range: AnalyticsRange, timeZone: string) {
  const start = zonedDayStart(range.from, timeZone);
  const end = zonedDayStart(addDays(range.to, 1), timeZone);
  return { start, end };
}

function percent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const COMPLETED: OrderStatus = 'completed';

export async function vendorAnalytics(
  userId: string,
  businessId: string,
  range: AnalyticsRange,
) {
  const business = await assertBusinessOwner(userId, businessId);

  const [branchRows] = await Promise.all([
    db
      .select({
        id: branches.id,
        name: branches.name,
        timezone: branches.timezone,
      })
      .from(branches)
      .where(eq(branches.businessId, businessId)),
  ]);

  const timezone = branchRows[0]?.timezone ?? config.DEFAULT_TIMEZONE;
  const { start, end } = rangeBounds(range, timezone);

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      branchId: orders.branchId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
      ),
    );

  const completed = rows.filter((row) => row.status === COMPLETED);
  const revenueCents = completed.reduce((total, row) => total + row.totalCents, 0);
  const ordersCompleted = completed.length;
  const ordersCancelled = rows.filter(
    (row) => row.status === 'cancelled' || row.status === 'rejected',
  ).length;

  const days =
    Math.round((end.getTime() - start.getTime()) / 86_400_000) || 1;
  const previousFrom = addDays(range.from, -days);
  const previousTo = addDays(range.from, -1);

  const previousRows = await db
    .select({
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        gte(orders.createdAt, zonedDayStart(previousFrom, timezone)),
        lt(orders.createdAt, zonedDayStart(addDays(previousTo, 1), timezone)),
      ),
    );

  const previousCompleted = previousRows.filter((row) => row.status === COMPLETED);
  const previousRevenue = previousCompleted.reduce(
    (total, row) => total + row.totalCents,
    0,
  );

  const branchMap = new Map(
    branchRows.map((branch) => [
      branch.id,
      { branchId: branch.id, branchName: branch.name, revenueCents: 0, ordersCompleted: 0 },
    ]),
  );
  for (const row of completed) {
    const entry = branchMap.get(row.branchId);
    if (entry) {
      entry.revenueCents += row.totalCents;
      entry.ordersCompleted += 1;
    }
  }

  const seriesMap = new Map<string, { bucket: string; revenueCents: number; orders: number }>();
  for (const row of completed) {
    const bucket = bucketFor(row.createdAt, timezone, range.granularity);
    const entry = seriesMap.get(bucket) ?? { bucket, revenueCents: 0, orders: 0 };
    entry.revenueCents += row.totalCents;
    entry.orders += 1;
    seriesMap.set(bucket, entry);
  }

  const funnelMap = new Map<string, number>();
  for (const status of ORDER_STATUSES) {
    funnelMap.set(status, 0);
  }
  for (const row of rows) {
    funnelMap.set(row.status, (funnelMap.get(row.status) ?? 0) + 1);
  }

  let topProducts: {
    productId: string;
    name: string;
    qty: number;
    revenueCents: number;
  }[] = [];

  if (completed.length > 0) {
    const itemRows = await db
      .select({
        productId: orderItems.productId,
        name: orderItems.nameSnapshot,
        qty: orderItems.qty,
        lineTotalCents: orderItems.lineTotalCents,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, completed.map((row) => row.id)));

    const productMap = new Map<
      string,
      { productId: string; name: string; qty: number; revenueCents: number }
    >();
    for (const item of itemRows) {
      const entry = productMap.get(item.productId) ?? {
        productId: item.productId,
        name: item.name,
        qty: 0,
        revenueCents: 0,
      };
      entry.qty += item.qty;
      entry.revenueCents += item.lineTotalCents;
      productMap.set(item.productId, entry);
    }
    topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }

  return {
    businessId,
    businessName: business.name,
    currency: business.currency,
    timezone,
    range,
    summary: {
      revenueCents,
      ordersCompleted,
      ordersCreated: rows.length,
      ordersCancelled,
      avgTicketCents:
        ordersCompleted > 0 ? Math.round(revenueCents / ordersCompleted) : 0,
    },
    comparison: {
      revenuePct: percent(revenueCents, previousRevenue),
      ordersPct: percent(ordersCompleted, previousCompleted.length),
      previous: {
        revenueCents: previousRevenue,
        ordersCompleted: previousCompleted.length,
      },
    },
    byBranch: Array.from(branchMap.values()).sort(
      (a, b) => b.revenueCents - a.revenueCents,
    ),
    timeseries: Array.from(seriesMap.values()).sort((a, b) =>
      a.bucket.localeCompare(b.bucket),
    ),
    topProducts,
    funnel: Array.from(funnelMap.entries()).map(([status, count]) => ({
      status,
      count,
    })),
  };
}

export async function buyerAnalytics(userId: string, range: AnalyticsRange) {
  const timezone = config.DEFAULT_TIMEZONE;
  const { start, end } = rangeBounds(range, timezone);

  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      businessId: orders.businessId,
      branchId: orders.branchId,
      createdAt: orders.createdAt,
      etaAt: orders.etaAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.buyerUserId, userId),
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
      ),
    );

  const businessIds = Array.from(new Set(rows.map((row) => row.businessId)));
  const businessRows = businessIds.length
    ? await db
        .select({ id: businesses.id, name: businesses.name })
        .from(businesses)
        .where(inArray(businesses.id, businessIds))
    : [];
  const businessName = new Map(businessRows.map((business) => [business.id, business.name]));

  const branchIds = Array.from(
    new Set(
      rows
        .filter(
          (row) =>
            row.status !== 'completed' &&
            row.status !== 'cancelled' &&
            row.status !== 'rejected',
        )
        .map((row) => row.branchId),
    ),
  );
  const branchRows = branchIds.length
    ? await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(inArray(branches.id, branchIds))
    : [];
  const branchName = new Map(branchRows.map((branch) => [branch.id, branch.name]));

  const completed = rows.filter((row) => row.status === COMPLETED);

  const totalsMap = new Map<
    string,
    { currency: string; spentCents: number; ordersCompleted: number; avgTicketCents: number }
  >();
  for (const row of completed) {
    const entry = totalsMap.get(row.currency) ?? {
      currency: row.currency,
      spentCents: 0,
      ordersCompleted: 0,
      avgTicketCents: 0,
    };
    entry.spentCents += row.totalCents;
    entry.ordersCompleted += 1;
    totalsMap.set(row.currency, entry);
  }
  for (const entry of totalsMap.values()) {
    entry.avgTicketCents =
      entry.ordersCompleted > 0 ? Math.round(entry.spentCents / entry.ordersCompleted) : 0;
  }

  const seriesMap = new Map<
    string,
    { bucket: string; currency: string; spentCents: number; orders: number }
  >();
  for (const row of completed) {
    const bucket = bucketFor(row.createdAt, timezone, range.granularity);
    const key = `${bucket}|${row.currency}`;
    const entry = seriesMap.get(key) ?? {
      bucket,
      currency: row.currency,
      spentCents: 0,
      orders: 0,
    };
    entry.spentCents += row.totalCents;
    entry.orders += 1;
    seriesMap.set(key, entry);
  }

  const frequentMap = new Map<
    string,
    { businessId: string; businessName: string; currency: string; orders: number; spentCents: number }
  >();
  for (const row of completed) {
    const key = `${row.businessId}|${row.currency}`;
    const entry = frequentMap.get(key) ?? {
      businessId: row.businessId,
      businessName: businessName.get(row.businessId) ?? 'Comercio',
      currency: row.currency,
      orders: 0,
      spentCents: 0,
    };
    entry.orders += 1;
    entry.spentCents += row.totalCents;
    frequentMap.set(key, entry);
  }

  const activeOrders = rows
    .filter(
      (row) =>
        row.status !== 'completed' &&
        row.status !== 'cancelled' &&
        row.status !== 'rejected',
    )
    .map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      totalCents: row.totalCents,
      currency: row.currency,
      businessName: businessName.get(row.businessId) ?? 'Comercio',
      branchName: branchName.get(row.branchId) ?? 'Sucursal',
      createdAt: row.createdAt,
      etaAt: row.etaAt,
    }));

  return {
    range,
    timezone,
    ordersCreated: rows.length,
    totalsByCurrency: Array.from(totalsMap.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    activeOrders,
    timeseries: Array.from(seriesMap.values()).sort((a, b) =>
      a.bucket.localeCompare(b.bucket),
    ),
    frequent: Array.from(frequentMap.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5),
  };
}

export function parseRange(query: {
  from?: string;
  to?: string;
  granularity?: Granularity;
}): AnalyticsRange {
  const timezone = config.DEFAULT_TIMEZONE;
  const today = new Date().toISOString().slice(0, 10);
  const to = query.to ?? today;
  const from = query.from ?? addDays(to, -29);
  if (from > to) {
    throw new AppError('INVALID_RANGE', 'La fecha inicial no puede ser mayor.', 400);
  }
  return { from, to, granularity: query.granularity ?? 'day' };
}

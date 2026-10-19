import { authedRequest } from './authed';
import type { CurrencyCode } from './discovery';
import type { OrderStatus } from './orders';

export type Granularity = 'day' | 'week' | 'month';

export interface AnalyticsRange {
  from: string;
  to: string;
  granularity: Granularity;
}

export interface VendorSummary {
  revenueCents: number;
  ordersCompleted: number;
  ordersCreated: number;
  ordersCancelled: number;
  avgTicketCents: number;
}

export interface VendorAnalytics {
  businessId: string;
  businessName: string;
  currency: CurrencyCode;
  timezone: string;
  range: AnalyticsRange;
  summary: VendorSummary;
  comparison: {
    revenuePct: number | null;
    ordersPct: number | null;
    previous: { revenueCents: number; ordersCompleted: number };
  };
  byBranch: {
    branchId: string;
    branchName: string;
    revenueCents: number;
    ordersCompleted: number;
  }[];
  timeseries: { bucket: string; revenueCents: number; orders: number }[];
  topProducts: {
    productId: string;
    name: string;
    qty: number;
    revenueCents: number;
  }[];
  funnel: { status: OrderStatus; count: number }[];
}

export interface BuyerAnalytics {
  range: AnalyticsRange;
  timezone: string;
  ordersCreated: number;
  totalsByCurrency: {
    currency: CurrencyCode;
    spentCents: number;
    ordersCompleted: number;
    avgTicketCents: number;
  }[];
  activeOrders: {
    id: string;
    code: string;
    status: OrderStatus;
    totalCents: number;
    currency: CurrencyCode;
    businessName: string;
    branchName: string;
    createdAt: string;
    etaAt: string | null;
  }[];
  timeseries: {
    bucket: string;
    currency: CurrencyCode;
    spentCents: number;
    orders: number;
  }[];
  frequent: {
    businessId: string;
    businessName: string;
    currency: CurrencyCode;
    orders: number;
    spentCents: number;
  }[];
}

export async function getVendorAnalytics(input: {
  businessId: string;
  from: string;
  to: string;
  granularity: Granularity;
}): Promise<VendorAnalytics> {
  const query = new URLSearchParams({
    businessId: input.businessId,
    from: input.from,
    to: input.to,
    granularity: input.granularity,
  });
  return authedRequest<VendorAnalytics>(`/v1/analytics/vendor?${query.toString()}`);
}

export async function getBuyerAnalytics(input: {
  from: string;
  to: string;
  granularity: Granularity;
}): Promise<BuyerAnalytics> {
  const query = new URLSearchParams({
    from: input.from,
    to: input.to,
    granularity: input.granularity,
  });
  return authedRequest<BuyerAnalytics>(`/v1/analytics/buyer?${query.toString()}`);
}

export function rangeForDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

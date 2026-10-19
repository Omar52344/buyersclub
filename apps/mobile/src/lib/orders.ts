import type { CurrencyCode } from './discovery';
import { authedRequest } from './authed';

export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type PaymentMethod = 'cash' | 'transfer' | 'card_terminal' | 'other';

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  unitPriceCents: number;
  qty: number;
  lineTotalCents: number;
  notes: string | null;
}

export interface OrderEvent {
  status: OrderStatus;
  note: string | null;
  at: string;
}

export interface OrderDetail {
  id: string;
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  fulfillment: 'delivery' | 'pickup';
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: CurrencyCode;
  notes: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  deliveryAddress: {
    line1?: string;
    line2?: string | null;
    city?: string;
    recipientName?: string | null;
    phone?: string | null;
    notes?: string | null;
  } | null;
  etaAt: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  branch: { id: string; name: string; addressLine: string; city: string; phone: string | null };
  business: { id: string; name: string };
  items: OrderItem[];
  events: OrderEvent[];
  conversationId: string | null;
  canCancel: boolean;
  viewer: 'buyer' | 'vendor';
}

export interface OrderSummary {
  id: string;
  code: string;
  status: OrderStatus;
  totalCents: number;
  currency: CurrencyCode;
  fulfillment: 'delivery' | 'pickup';
  createdAt: string;
  etaAt: string | null;
  branchName: string;
  businessName: string;
  itemCount: number;
  firstItem: string | null;
}

export interface BusinessOrder {
  id: string;
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  fulfillment: 'delivery' | 'pickup';
  totalCents: number;
  currency: CurrencyCode;
  buyerName: string | null;
  buyerPhone: string | null;
  deliveryAddressSnapshot: unknown;
  etaAt: string | null;
  createdAt: string;
  branchName: string;
  items: { name: string; qty: number }[];
}

export async function createOrder(input: {
  branchId: string;
  fulfillment: 'delivery' | 'pickup';
  paymentMethod: PaymentMethod;
  items: { productId: string; qty: number }[];
  deliveryAddress?: {
    line1: string;
    line2?: string;
    city: string;
    recipientName?: string;
    phone?: string;
    notes?: string;
  };
  notes?: string;
  clientTotalCents?: number;
}): Promise<OrderDetail> {
  const response = await authedRequest<{ order: OrderDetail }>('/v1/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.order;
}

export async function getOrders(): Promise<OrderSummary[]> {
  const response = await authedRequest<{ orders: OrderSummary[] }>('/v1/orders');
  return response.orders;
}

export async function getOrder(id: string): Promise<OrderDetail> {
  const response = await authedRequest<{ order: OrderDetail }>(
    `/v1/orders/${encodeURIComponent(id)}`,
  );
  return response.order;
}

export async function cancelOrder(id: string, reason: string): Promise<OrderDetail> {
  const response = await authedRequest<{ order: OrderDetail }>(
    `/v1/orders/${encodeURIComponent(id)}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
  return response.order;
}

export async function getBusinessOrders(
  businessId: string,
  status?: OrderStatus,
): Promise<BusinessOrder[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await authedRequest<{ orders: BusinessOrder[] }>(
    `/v1/businesses/${encodeURIComponent(businessId)}/orders${query}`,
  );
  return response.orders;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  note?: string,
): Promise<OrderDetail> {
  const response = await authedRequest<{ order: OrderDetail }>(
    `/v1/orders/${encodeURIComponent(id)}/status`,
    { method: 'POST', body: JSON.stringify({ status, note }) },
  );
  return response.order;
}

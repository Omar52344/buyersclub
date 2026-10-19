import { fetchApi } from './api';
import type { PublicBranch } from './discovery';

export interface GuestBranchResponse {
  branch: PublicBranch;
  link: { token: string; webUrl: string; appUrl: string };
}

export interface GuestOrderItem {
  productId: string;
  qty: number;
  notes?: string;
}

export interface GuestOrderResponse {
  order: {
    id: string;
    code: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    fulfillment: 'delivery' | 'pickup';
    subtotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
    currency: 'COP' | 'USD';
    notes: string | null;
    etaAt: string | null;
    createdAt: string;
    branch: {
      id: string;
      name: string;
      addressLine: string;
      city: string;
      phone: string | null;
    };
    business: { id: string; name: string };
    items: {
      id: string;
      productId: string;
      name: string;
      unitPriceCents: number;
      qty: number;
      lineTotalCents: number;
    }[];
  };
  customer: { name: string; phone: string };
}

export async function getGuestBranch(token: string): Promise<GuestBranchResponse> {
  return fetchApi<GuestBranchResponse>(
    `/v1/public/qr/${encodeURIComponent(token)}`,
  );
}

export async function createGuestOrder(
  token: string,
  input: {
    name: string;
    phone: string;
    fulfillment: 'pickup' | 'delivery';
    paymentMethod: 'cash' | 'card_terminal';
    items: GuestOrderItem[];
    notes?: string;
    deliveryAddress?: {
      line1: string;
      line2?: string;
      city: string;
      recipientName?: string;
      phone?: string;
      notes?: string;
    };
  },
): Promise<GuestOrderResponse> {
  return fetchApi<GuestOrderResponse>(
    `/v1/public/qr/${encodeURIComponent(token)}/orders`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

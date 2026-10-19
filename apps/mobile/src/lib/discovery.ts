import { fetchApi } from './api';

export type CurrencyCode = 'COP' | 'USD';

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
  openReason: string;
  business: { id: string; name: string; currency: CurrencyCode };
  category: { id: string; name: string } | null;
  fulfillment: { delivery: boolean; pickup: boolean };
  deliveryFee: { amountCents: number; currency: CurrencyCode };
  minOrder: { amountCents: number; currency: CurrencyCode };
  productPreview: BranchProductPreview[];
}

export interface BranchSchedule {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface BranchException {
  date: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  note: string | null;
}

export interface PublicBranchProduct {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: CurrencyCode;
  stock: number | null;
  isAvailable: boolean;
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
  openReason: string;
  localTime: string;
  business: {
    id: string;
    name: string;
    description: string | null;
    currency: CurrencyCode;
    slug: string;
  };
  category: { id: string; name: string } | null;
  fulfillment: { delivery: boolean; pickup: boolean };
  deliveryFee: { amountCents: number; currency: CurrencyCode };
  minOrder: { amountCents: number; currency: CurrencyCode };
  prepTimeMinutes: number;
  etaMinutes: number;
  hours: BranchSchedule[];
  exceptions: BranchException[];
  products: PublicBranchProduct[];
}

export async function findNearby(input: {
  lat: number;
  lng: number;
  radius?: number;
  categoryId?: string | null;
  fulfillment?: 'all' | 'delivery' | 'pickup';
  openNow?: boolean;
  q?: string;
  limit?: number;
}): Promise<NearbyBranch[]> {
  const parts = [
    `lat=${input.lat}`,
    `lng=${input.lng}`,
    `radius=${input.radius ?? 5000}`,
    `openNow=${input.openNow ? 'true' : 'false'}`,
    `limit=${input.limit ?? 50}`,
  ];
  if (input.fulfillment && input.fulfillment !== 'all') {
    parts.push(`fulfillment=${input.fulfillment}`);
  }
  if (input.categoryId) {
    parts.push(`categoryId=${encodeURIComponent(input.categoryId)}`);
  }
  if (input.q) {
    parts.push(`q=${encodeURIComponent(input.q)}`);
  }

  const response = await fetchApi<{ items: NearbyBranch[] }>(
    `/v1/discovery/branches?${parts.join('&')}`,
  );
  return response.items;
}

export async function getPublicBranch(id: string): Promise<PublicBranch> {
  const response = await fetchApi<{ branch: PublicBranch }>(
    `/v1/discovery/branches/${encodeURIComponent(id)}`,
  );
  return response.branch;
}

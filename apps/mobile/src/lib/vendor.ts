import { ApiError, bearer, fetchApi } from './api';
import { loadSession, saveSession } from './token-store';

export type CurrencyCode = 'COP' | 'USD';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface BranchSummary {
  id: string;
  name: string;
  city: string;
  addressLine: string;
  manualOpen: boolean;
  status: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFeeCents: number;
  minOrderCents: number;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  currency: CurrencyCode;
  status: string;
  branches: BranchSummary[];
  productCount: number;
}

export interface ProductBranch {
  branchId: string;
  branchName: string;
  priceCents: number | null;
  stock: number | null;
  isAvailable: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  currency: CurrencyCode;
  isActive: boolean;
  shareWithAllBranches: boolean;
  branches: ProductBranch[];
}

async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const stored = await loadSession();
  if (!stored) {
    throw new ApiError(401, 'NO_SESSION', 'No hay una sesión activa.');
  }

  const run = (token: string) =>
    fetchApi<T>(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...bearer(token),
      },
    });

  try {
    return await run(stored.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    const refreshed = await fetchApi<{ accessToken: string; refreshToken: string }>(
      '/v1/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      },
    );
    await saveSession({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    });
    return run(refreshed.accessToken);
  }
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetchApi<{ categories: Category[] }>('/v1/categories');
  return response.categories;
}

export async function getMyBusinesses(): Promise<Business[]> {
  const response = await authedRequest<{ businesses: Business[] }>('/v1/businesses/me');
  return response.businesses;
}

export async function createBusiness(input: {
  name: string;
  description?: string;
  categoryId?: string;
  currency: CurrencyCode;
}): Promise<Business> {
  const response = await authedRequest<{ business: Business }>('/v1/businesses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.business;
}

export async function createBranch(
  businessId: string,
  input: {
    name: string;
    addressLine: string;
    city: string;
    phone?: string;
    lat?: number;
    lng?: number;
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    deliveryFeeCents: number;
    minOrderCents: number;
    prepTimeMinutes: number;
    deliveryEtaMinutes: number;
  },
): Promise<{ id: string }> {
  const response = await authedRequest<{ branch: { id: string } }>(
    `/v1/businesses/${businessId}/branches`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return response.branch;
}

export async function setBranchHours(
  branchId: string,
  ranges: { weekday: number; opensAt: string; closesAt: string }[],
): Promise<void> {
  await authedRequest(`/v1/branches/${branchId}/hours`, {
    method: 'PUT',
    body: JSON.stringify({ ranges, exceptions: [] }),
  });
}

export async function setBranchOpen(branchId: string, manualOpen: boolean): Promise<void> {
  await authedRequest(`/v1/branches/${branchId}/open`, {
    method: 'POST',
    body: JSON.stringify({ manualOpen }),
  });
}

export async function getProducts(businessId: string): Promise<Product[]> {
  const response = await authedRequest<{ products: Product[] }>(
    `/v1/products?businessId=${encodeURIComponent(businessId)}`,
  );
  return response.products;
}

export async function createProduct(input: {
  businessId: string;
  name: string;
  description?: string;
  basePriceCents: number;
  shareWithAllBranches: boolean;
  branchIds?: string[];
}): Promise<Product> {
  const response = await authedRequest<{ product: Product }>('/v1/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.product;
}

export async function setProductBranches(
  productId: string,
  branches: {
    branchId: string;
    priceCents?: number | null;
    stock?: number | null;
    isAvailable: boolean;
  }[],
): Promise<Product[]> {
  const response = await authedRequest<{ products: Product[] }>(
    `/v1/products/${productId}/branches`,
    {
      method: 'PUT',
      body: JSON.stringify({ branches }),
    },
  );
  return response.products;
}

export async function bulkSetBranchProducts(
  branchId: string,
  productIds: string[],
  isAvailable: boolean,
): Promise<number> {
  const response = await authedRequest<{ updated: number }>(
    `/v1/branches/${branchId}/products`,
    {
      method: 'PUT',
      body: JSON.stringify({ productIds, isAvailable }),
    },
  );
  return response.updated;
}

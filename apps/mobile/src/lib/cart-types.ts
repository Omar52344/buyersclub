import type { CurrencyCode } from './discovery';

export interface CartItem {
  productId: string;
  name: string;
  unitPriceCents: number;
  qty: number;
}

export interface CartBranch {
  branchId: string;
  branchName: string;
  businessName: string;
  currency: CurrencyCode;
  fulfillment: { delivery: boolean; pickup: boolean };
  deliveryFeeCents: number;
  minOrderCents: number;
}

export interface CartState extends CartBranch {
  items: CartItem[];
}

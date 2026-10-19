import type { CartState } from './cart-types';

const KEY = 'buyersclub.cart';

export async function loadCart(): Promise<CartState | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CartState;
  } catch {
    return null;
  }
}

export async function saveCart(cart: CartState | null): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  if (!cart || cart.items.length === 0) {
    window.localStorage.removeItem(KEY);
    return;
  }
  window.localStorage.setItem(KEY, JSON.stringify(cart));
}

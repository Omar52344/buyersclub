import * as SecureStore from 'expo-secure-store';
import type { CartState } from './cart-types';

const KEY = 'buyersclub.cart';

export async function loadCart(): Promise<CartState | null> {
  const raw = await SecureStore.getItemAsync(KEY);
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
  if (!cart || cart.items.length === 0) {
    await SecureStore.deleteItemAsync(KEY);
    return;
  }
  await SecureStore.setItemAsync(KEY, JSON.stringify(cart));
}

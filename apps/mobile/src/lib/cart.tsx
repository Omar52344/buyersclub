import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CartBranch, CartItem, CartState } from './cart-types';
import { loadCart, saveCart } from './cart-storage';

interface CartContextValue {
  cart: CartState | null;
  itemCount: number;
  subtotalCents: number;
  addItem: (branch: CartBranch, item: CartItem) => void;
  setQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadCart()
      .then((value) => {
        if (active) {
          setCart(value);
          setReady(true);
        }
      })
      .catch(() => setReady(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ready) {
      void saveCart(cart);
    }
  }, [cart, ready]);

  function addItem(branch: CartBranch, item: CartItem) {
    setCart((current) => {
      if (!current || current.branchId !== branch.branchId) {
        return { ...branch, items: [item] };
      }
      const existing = current.items.find((entry) => entry.productId === item.productId);
      if (existing) {
        return {
          ...current,
          items: current.items.map((entry) =>
            entry.productId === item.productId
              ? { ...entry, qty: entry.qty + item.qty }
              : entry,
          ),
        };
      }
      return { ...current, items: [...current.items, item] };
    });
  }

  function setQty(productId: string, qty: number) {
    setCart((current) => {
      if (!current) {
        return current;
      }
      const items =
        qty <= 0
          ? current.items.filter((entry) => entry.productId !== productId)
          : current.items.map((entry) =>
              entry.productId === productId ? { ...entry, qty } : entry,
            );
      return { ...current, items };
    });
  }

  function removeItem(productId: string) {
    setCart((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((entry) => entry.productId !== productId),
          }
        : current,
    );
  }

  function clear() {
    setCart(null);
  }

  const itemCount = cart?.items.reduce((total, item) => total + item.qty, 0) ?? 0;
  const subtotalCents =
    cart?.items.reduce((total, item) => total + item.unitPriceCents * item.qty, 0) ?? 0;

  return (
    <CartContext.Provider
      value={{ cart, itemCount, subtotalCents, addItem, setQty, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return value;
}

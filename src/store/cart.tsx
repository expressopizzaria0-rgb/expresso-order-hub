import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  size?: string;
  unitPrice: number;
  addonId?: string;
  addonName?: string;
  addonPrice: number;
  quantity: number;
  notes?: string;
};

type CartCtx = {
  items: CartItem[];
  add: (i: Omit<CartItem, "id">) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "expresso_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const value = useMemo<CartCtx>(() => ({
    items,
    add: (i) => setItems((prev) => [...prev, { ...i, id: crypto.randomUUID() }]),
    remove: (id) => setItems((prev) => prev.filter((x) => x.id !== id)),
    setQty: (id, qty) => setItems((prev) => prev.map((x) => x.id === id ? { ...x, quantity: Math.max(1, qty) } : x)),
    clear: () => setItems([]),
    subtotal: items.reduce((s, i) => s + (i.unitPrice + i.addonPrice) * i.quantity, 0),
    count: items.reduce((s, i) => s + i.quantity, 0),
  }), [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
};

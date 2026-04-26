import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = { id: string; name: string; slug: string; sort_order: number; active: boolean };
export type ProductSize = { id: string; product_id: string; size: string; price: number; sort_order: number };
export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  has_sizes: boolean;
  price: number | null;
  active: boolean;
  sort_order: number;
  product_sizes: ProductSize[];
};
export type Addon = { id: string; name: string; price: number; active: boolean; sort_order: number };

export function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const [cats, prods, addons] = await Promise.all([
        supabase.from("categories").select("*").eq("active", true).order("sort_order"),
        supabase.from("products").select("*, product_sizes(*)").eq("active", true).order("sort_order"),
        supabase.from("addons").select("*").eq("active", true).order("sort_order"),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      if (addons.error) throw addons.error;
      return {
        categories: (cats.data || []) as Category[],
        products: ((prods.data || []) as any[]).map((p) => ({
          ...p,
          product_sizes: (p.product_sizes || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        })) as Product[],
        addons: (addons.data || []) as Addon[],
      };
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });
}

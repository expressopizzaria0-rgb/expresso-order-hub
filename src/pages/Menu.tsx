import { useState, useMemo } from "react";
import { useMenu } from "@/hooks/useMenu";
import type { Product } from "@/hooks/useMenu";
import PublicHeader from "@/components/PublicHeader";
import ProductDialog from "@/components/ProductDialog";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { Loader2 } from "lucide-react";

const MenuPage = () => {
  const { data, isLoading } = useMenu();
  const [activeCat, setActiveCat] = useState<string>("");
  const [selected, setSelected] = useState<Product | null>(null);

  const productsByCat = useMemo(() => {
    const m: Record<string, Product[]> = {};
    (data?.products || []).forEach((p) => {
      (m[p.category_id] ||= []).push(p);
    });
    return m;
  }, [data]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  );

  const cats = (data?.categories || []).filter((c) => (productsByCat[c.id] || []).length > 0);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero */}
      <section className="chalk-board py-8 md:py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="pizza-title text-4xl md:text-6xl text-[hsl(var(--pizza-yellow))] drop-shadow-lg">
            CARDÁPIO
          </h1>
          <p className="text-[hsl(var(--chalk-text))]/80 mt-2">Saboreie a melhor pizza e esfirra de Caruaru 🍕</p>
        </div>
      </section>

      {/* Cat tabs */}
      <div className="sticky top-[88px] md:top-[96px] z-30 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-2 overflow-x-auto">
          <div className="flex gap-2 py-3 min-w-max">
            {cats.map((c) => (
              <a key={c.id} href={`#cat-${c.id}`} onClick={() => setActiveCat(c.id)}
                 className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                {c.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 space-y-10">
        {cats.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-40">
            <h2 className="pizza-title text-3xl text-primary mb-4 border-b-2 border-primary/30 pb-1">{c.name}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(productsByCat[c.id] || []).map((p) => {
                const minPrice = p.has_sizes
                  ? Math.min(...p.product_sizes.map((s) => Number(s.price)))
                  : Number(p.price ?? 0);
                return (
                  <button key={p.id} onClick={() => setSelected(p)}
                    className="text-left bg-card border rounded-lg p-4 hover:border-primary hover:shadow-[var(--shadow-warm)] transition group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="pizza-title text-xl text-primary group-hover:text-primary/80">{p.name}</h3>
                        {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground uppercase">{p.has_sizes ? "a partir de" : "valor"}</div>
                        <div className="text-lg font-bold text-primary">{brl(minPrice)}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2 w-full">Adicionar</Button>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <footer className="chalk-board py-8 mt-10 text-center text-[hsl(var(--chalk-text))]/80 text-sm">
        <p className="pizza-title text-2xl text-[hsl(var(--pizza-yellow))]">EXPRESSO PIZZA E ESFIRRA</p>
        <p className="mt-2">R. Vig. Antônio Jorge, 46 - São Francisco, Caruaru-PE</p>
        <p>Delivery: (81) 98975-7972 · Aberto das 16h às 23h</p>
      </footer>

      <ProductDialog
        product={selected}
        categoryName={cats.find((c) => c.id === selected?.category_id)?.name || ""}
        addons={selected?.has_sizes ? (data?.addons || []) : []}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
};

export default MenuPage;

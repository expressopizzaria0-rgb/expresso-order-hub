import { Link } from "react-router-dom";
import { ShoppingBag, MapPin, Clock, Phone } from "lucide-react";
import { useCart } from "@/store/cart";
import { useSettings } from "@/hooks/useMenu";
import { Button } from "@/components/ui/button";

export default function PublicHeader() {
  const { count } = useCart();
  const { data: s } = useSettings();
  return (
    <header className="chalk-board sticky top-0 z-40 shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="pizza-title text-3xl md:text-4xl text-[hsl(var(--pizza-yellow))]">EXPRESSO</span>
          <span className="hidden sm:flex gap-1 text-xs font-bold">
            <span className="bg-[hsl(var(--pizza-green))] px-2 py-0.5 rounded text-white">PIZZA</span>
            <span className="bg-[hsl(var(--pizza-red))] px-2 py-0.5 rounded text-white">ESFIRRA</span>
          </span>
        </Link>
        <Link to="/checkout">
          <Button size="lg" className="relative gap-2 shadow-[var(--shadow-warm)]">
            <ShoppingBag className="h-5 w-5" />
            <span className="hidden sm:inline">Carrinho</span>
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-[hsl(var(--pizza-yellow))] text-[hsl(var(--chalk-bg))] rounded-full h-6 min-w-6 px-1.5 text-xs font-bold flex items-center justify-center">{count}</span>
            )}
          </Button>
        </Link>
      </div>
      <div className="bg-[hsl(var(--chalk-bg-2))] text-xs md:text-sm text-[hsl(var(--chalk-text))]/80">
        <div className="container mx-auto px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{s?.store_address}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{s?.store_hours}</span>
          <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />(81) 98975-7972</span>
        </div>
      </div>
    </header>
  );
}

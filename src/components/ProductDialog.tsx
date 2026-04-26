import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Minus } from "lucide-react";
import type { Product, Addon } from "@/hooks/useMenu";
import { brl } from "@/lib/format";
import { useCart } from "@/store/cart";
import { toast } from "sonner";

export default function ProductDialog({
  product, categoryName, addons, open, onOpenChange,
}: {
  product: Product | null;
  categoryName: string;
  addons: Addon[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { add } = useCart();
  const [size, setSize] = useState<string>("");
  const [addonId, setAddonId] = useState<string>("none");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  if (!product) return null;
  const sizes = product.product_sizes || [];
  const showAddons = product.has_sizes && addons.length > 0;
  const selectedSize = sizes.find((s) => s.size === size);
  const unit = product.has_sizes ? Number(selectedSize?.price ?? 0) : Number(product.price ?? 0);
  const addon = addons.find((a) => a.id === addonId);
  const total = (unit + Number(addon?.price ?? 0)) * qty;

  const handleAdd = () => {
    if (product.has_sizes && !selectedSize) { toast.error("Escolha um tamanho"); return; }
    add({
      productId: product.id,
      productName: product.name,
      categoryId: product.category_id,
      categoryName,
      size: selectedSize?.size,
      unitPrice: unit,
      addonId: addon?.id,
      addonName: addon?.name,
      addonPrice: Number(addon?.price ?? 0),
      quantity: qty,
      notes: notes.trim() || undefined,
    });
    toast.success(`${product.name} adicionado`);
    onOpenChange(false);
    setSize(""); setAddonId("none"); setQty(1); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pizza-title text-2xl text-primary">{product.name}</DialogTitle>
          {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
        </DialogHeader>

        {product.has_sizes && (
          <div>
            <Label className="mb-2 block">Tamanho</Label>
            <RadioGroup value={size} onValueChange={setSize} className="grid grid-cols-2 gap-2">
              {sizes.map((s) => (
                <Label key={s.id} htmlFor={s.id} className={`flex items-center justify-between border rounded-md p-3 cursor-pointer ${size === s.size ? "border-primary bg-primary/5" : ""}`}>
                  <span className="flex items-center gap-2"><RadioGroupItem value={s.size} id={s.id} /><span className="font-semibold">{s.size}</span></span>
                  <span className="font-bold text-primary">{brl(Number(s.price))}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )}

        {showAddons && (
          <div>
            <Label className="mb-2 block">Borda recheada (opcional)</Label>
            <RadioGroup value={addonId} onValueChange={setAddonId} className="space-y-1.5">
              <Label className={`flex items-center justify-between border rounded-md p-2.5 cursor-pointer ${addonId === "none" ? "border-primary bg-primary/5" : ""}`}>
                <span className="flex items-center gap-2"><RadioGroupItem value="none" id="none" />Sem borda</span>
                <span className="text-muted-foreground text-sm">Grátis</span>
              </Label>
              {addons.map((a) => (
                <Label key={a.id} className={`flex items-center justify-between border rounded-md p-2.5 cursor-pointer ${addonId === a.id ? "border-primary bg-primary/5" : ""}`}>
                  <span className="flex items-center gap-2"><RadioGroupItem value={a.id} id={a.id} />{a.name}</span>
                  <span className="font-semibold text-primary">+ {brl(Number(a.price))}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )}

        <div>
          <Label htmlFor="notes">Observação (opcional)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: sem cebola" maxLength={200} rows={2} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
            <span className="w-10 text-center font-bold">{qty}</span>
            <Button variant="outline" size="icon" onClick={() => setQty((q) => q + 1)}><Plus className="h-4 w-4" /></Button>
          </div>
          <span className="text-2xl font-bold text-primary">{brl(total)}</span>
        </div>

        <DialogFooter>
          <Button onClick={handleAdd} size="lg" className="w-full">Adicionar ao carrinho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

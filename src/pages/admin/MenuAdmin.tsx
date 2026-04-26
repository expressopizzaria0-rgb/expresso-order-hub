import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export default function MenuAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: async () => {
      const [c, p, a] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("products").select("*, product_sizes(*)").order("sort_order"),
        supabase.from("addons").select("*").order("sort_order"),
      ]);
      return { categories: c.data || [], products: p.data || [], addons: a.data || [] };
    },
  });

  if (isLoading) return <Loader2 className="animate-spin h-6 w-6 text-primary" />;

  const del = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-menu"] });
    qc.invalidateQueries({ queryKey: ["menu"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cardápio</h1>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Novo produto</Button>
      </div>

      {data?.categories.map((c: any) => (
        <Card key={c.id} className="p-4">
          <h2 className="font-bold text-lg text-primary mb-2">{c.name}</h2>
          <div className="space-y-1">
            {data.products.filter((p: any) => p.category_id === c.id).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {p.name}
                    {!p.active && <span className="text-xs bg-muted px-2 rounded">inativo</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                  <div className="text-xs text-primary">
                    {p.has_sizes
                      ? (p.product_sizes || []).sort((a: any,b: any)=>a.sort_order-b.sort_order).map((s: any) => `${s.size}: ${brl(Number(s.price))}`).join(" · ")
                      : brl(Number(p.price ?? 0))}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {(creating || editing) && (
        <ProductForm
          product={editing}
          categories={data?.categories || []}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-menu"] });
            qc.invalidateQueries({ queryKey: ["menu"] });
          }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }: any) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [categoryId, setCategoryId] = useState(product?.category_id || categories[0]?.id || "");
  const [hasSizes, setHasSizes] = useState(product?.has_sizes || false);
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [active, setActive] = useState(product?.active ?? true);
  const [sizes, setSizes] = useState<{ size: string; price: string }[]>(
    product?.product_sizes?.length
      ? product.product_sizes.map((s: any) => ({ size: s.size, price: String(s.price) }))
      : [{ size: "P", price: "" }, { size: "M", price: "" }, { size: "G", price: "" }, { size: "GG", price: "" }]
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(), description: description.trim() || null,
        category_id: categoryId, has_sizes: hasSizes, active,
        price: hasSizes ? null : Number(price.replace(",", ".")) || 0,
      };
      let productId = product?.id;
      if (product) {
        await supabase.from("products").update(payload).eq("id", product.id);
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = data.id;
      }
      if (hasSizes) {
        await supabase.from("product_sizes").delete().eq("product_id", productId);
        await supabase.from("product_sizes").insert(
          sizes.filter(s => s.size && s.price).map((s, i) => ({
            product_id: productId, size: s.size, price: Number(s.price.replace(",", ".")) || 0, sort_order: i,
          }))
        );
      } else {
        await supabase.from("product_sizes").delete().eq("product_id", productId);
      }
      toast.success("Produto salvo");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div><Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2"><Switch checked={hasSizes} onCheckedChange={setHasSizes} /><Label>Tem tamanhos (P/M/G/GG)</Label></div>
          {hasSizes ? (
            <div className="space-y-2">
              <Label>Preços por tamanho</Label>
              {sizes.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="w-20" value={s.size} onChange={(e) => setSizes(sz => sz.map((x, j) => j === i ? { ...x, size: e.target.value } : x))} />
                  <Input placeholder="Preço" value={s.price} onChange={(e) => setSizes(sz => sz.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                </div>
              ))}
            </div>
          ) : (
            <div><Label>Preço</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 5,00" /></div>
          )}
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Ativo</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

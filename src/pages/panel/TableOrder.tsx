import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMenu } from "@/hooks/useMenu";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { brl } from "@/lib/format";
import { ArrowLeft, Plus, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export default function TableOrder() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: menu } = useMenu();
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState(false);
  const [payment, setPayment] = useState<"dinheiro" | "pix" | "cartao">("dinheiro");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["table-order", id],
    queryFn: async () => {
      const { data: table, error: te } = await supabase.from("tables").select("*").eq("id", id!).single();
      if (te) throw te;
      let order: any = null;
      const { data: existing } = await supabase
        .from("orders").select("*").eq("table_id", id!).eq("status", "aberta").maybeSingle();
      order = existing;
      let items: any[] = [];
      if (order) {
        const { data: oi } = await supabase.from("order_items").select("*").eq("order_id", order.id).order("created_at");
        items = oi || [];
      }
      return { table, order, items };
    },
  });

  const subtotal = useMemo(() => (data?.items || []).reduce((s, i) => s + Number(i.line_total), 0), [data]);

  useEffect(() => {
    if (data?.order) {
      // Recompute totals when items change
      const newTotal = subtotal;
      if (Number(data.order.total) !== newTotal) {
        supabase.from("orders").update({ subtotal: newTotal, total: newTotal }).eq("id", data.order.id).then(() => refetch());
      }
    }
  }, [subtotal, data?.order?.id]);

  if (isLoading) return <Loader2 className="animate-spin h-6 w-6 text-primary" />;

  const ensureOrder = async () => {
    if (data?.order) return data.order.id;
    const { data: newOrder, error } = await supabase.from("orders").insert({
      channel: "salao", order_type: "mesa", table_id: id!, waiter_id: user!.id,
      status: "aberta", subtotal: 0, total: 0, payment_method: "pendente",
    }).select("id").single();
    if (error) throw error;
    await supabase.from("tables").update({ status: "ocupada" }).eq("id", id!);
    qc.invalidateQueries({ queryKey: ["tables-with-totals"] });
    return newOrder.id;
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("order_items").delete().eq("id", itemId);
    refetch();
  };

  const closeBill = async () => {
    if (!data?.order) return;
    await supabase.from("orders").update({
      status: "fechada", payment_method: payment, closed_at: new Date().toISOString(),
    }).eq("id", data.order.id);
    await supabase.from("tables").update({ status: "livre" }).eq("id", id!);
    toast.success("Conta fechada!");
    qc.invalidateQueries({ queryKey: ["tables-with-totals"] });
    nav("/painel/mesas");
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => nav("/painel/mesas")}><ArrowLeft className="h-4 w-4 mr-1" /> Mesas</Button>
        <h1 className="text-2xl font-bold">Mesa {data?.table.number}</h1>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Item</Button>
      </div>

      <Card className="p-4 space-y-2">
        {(data?.items || []).length === 0 && <p className="text-muted-foreground text-center py-6">Nenhum item ainda. Clique em "Item" para começar.</p>}
        {(data?.items || []).map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2 border-b last:border-0 pb-2 last:pb-0">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{i.quantity}x {i.product_name}{i.size ? ` (${i.size})` : ""}</div>
              {i.addon_name && <div className="text-xs text-muted-foreground">+ {i.addon_name}</div>}
              {i.notes && <div className="text-xs italic text-muted-foreground">{i.notes}</div>}
            </div>
            <div className="text-right">
              <div className="font-bold text-primary">{brl(Number(i.line_total))}</div>
            </div>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(i.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {(data?.items || []).length > 0 && (
          <div className="flex justify-between text-xl font-bold pt-3 border-t">
            <span>Total</span><span className="text-primary">{brl(subtotal)}</span>
          </div>
        )}
      </Card>

      {(data?.items || []).length > 0 && (
        <Button size="lg" className="w-full" onClick={() => setClosing(true)}>Fechar conta</Button>
      )}

      {adding && menu && (
        <AddItemDialog
          open={adding} onOpenChange={setAdding}
          onAdd={async (item) => {
            const orderId = await ensureOrder();
            await supabase.from("order_items").insert({ ...item, order_id: orderId });
            refetch();
            qc.invalidateQueries({ queryKey: ["tables-with-totals"] });
          }}
          menu={menu}
        />
      )}

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fechar conta — {brl(subtotal)}</DialogTitle></DialogHeader>
          <div>
            <Label className="mb-2 block">Forma de pagamento</Label>
            <RadioGroup value={payment} onValueChange={(v: any) => setPayment(v)} className="grid grid-cols-3 gap-2">
              {[["dinheiro", "Dinheiro"], ["pix", "Pix"], ["cartao", "Cartão"]].map(([v, l]) => (
                <Label key={v} className={`border rounded-md p-3 cursor-pointer flex items-center gap-2 justify-center ${payment === v ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value={v} /> {l}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter><Button onClick={closeBill} className="w-full">Confirmar pagamento</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddItemDialog({ open, onOpenChange, onAdd, menu }: any) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [size, setSize] = useState("");
  const [addonId, setAddonId] = useState("none");
  const [qty, setQty] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return menu.products.filter((p: any) => p.name.toLowerCase().includes(q));
  }, [search, menu]);

  const reset = () => { setSelected(null); setSize(""); setAddonId("none"); setQty(1); setSearch(""); };

  const submit = async () => {
    const cat = menu.categories.find((c: any) => c.id === selected.category_id);
    const sz = selected.has_sizes ? selected.product_sizes.find((s: any) => s.size === size) : null;
    if (selected.has_sizes && !sz) { toast.error("Escolha tamanho"); return; }
    const unit = selected.has_sizes ? Number(sz.price) : Number(selected.price ?? 0);
    const addon = menu.addons.find((a: any) => a.id === addonId);
    const addonPrice = Number(addon?.price ?? 0);
    await onAdd({
      product_id: selected.id, product_name: selected.name,
      category_id: selected.category_id, category_name: cat?.name || "",
      size: sz?.size || null, addon_id: addon?.id || null, addon_name: addon?.name || null,
      addon_price: addonPrice, quantity: qty, unit_price: unit,
      line_total: (unit + addonPrice) * qty, notes: null,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{selected ? selected.name : "Adicionar item"}</DialogTitle></DialogHeader>
        {!selected ? (
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filtered.map((p: any) => {
                const cat = menu.categories.find((c: any) => c.id === p.category_id);
                return (
                  <button key={p.id} onClick={() => setSelected(p)}
                    className="w-full text-left p-2 hover:bg-secondary rounded flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{cat?.name}</div>
                    </div>
                    <div className="text-sm text-primary font-bold">
                      {p.has_sizes ? `a partir ${brl(Math.min(...p.product_sizes.map((s: any) => Number(s.price))))}` : brl(Number(p.price))}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {selected.has_sizes && (
              <div>
                <Label className="mb-2 block">Tamanho</Label>
                <RadioGroup value={size} onValueChange={setSize} className="grid grid-cols-2 gap-2">
                  {selected.product_sizes.map((s: any) => (
                    <Label key={s.id} className={`border rounded p-2 cursor-pointer flex justify-between ${size === s.size ? "border-primary bg-primary/5" : ""}`}>
                      <span className="flex gap-2 items-center"><RadioGroupItem value={s.size} /> {s.size}</span>
                      <span className="font-bold text-primary">{brl(Number(s.price))}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            )}
            {selected.has_sizes && menu.addons.length > 0 && (
              <div>
                <Label className="mb-2 block">Borda (opcional)</Label>
                <RadioGroup value={addonId} onValueChange={setAddonId} className="space-y-1">
                  <Label className={`border rounded p-2 cursor-pointer flex justify-between ${addonId === "none" ? "border-primary bg-primary/5" : ""}`}>
                    <span className="flex gap-2 items-center"><RadioGroupItem value="none" /> Sem borda</span>
                  </Label>
                  {menu.addons.map((a: any) => (
                    <Label key={a.id} className={`border rounded p-2 cursor-pointer flex justify-between ${addonId === a.id ? "border-primary bg-primary/5" : ""}`}>
                      <span className="flex gap-2 items-center"><RadioGroupItem value={a.id} /> {a.name}</span>
                      <span className="font-semibold text-primary">+ {brl(Number(a.price))}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            )}
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>Voltar</Button>
              <Button onClick={submit}>Adicionar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import PublicHeader from "@/components/PublicHeader";
import { useCart } from "@/store/cart";
import { useSettings } from "@/hooks/useMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { brl, phoneDigits } from "@/lib/format";
import { Plus, Minus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  phone: z.string().trim().min(10, "Telefone inválido").max(20),
  type: z.enum(["delivery", "retirada"]),
  payment: z.enum(["dinheiro", "pix", "cartao"]),
  address: z.string().max(200).optional(),
  neighborhood: z.string().max(100).optional(),
  changeFor: z.string().max(20).optional(),
  notes: z.string().max(300).optional(),
});

export default function Checkout() {
  const { items, setQty, remove, subtotal, clear } = useCart();
  const { data: settings } = useSettings();
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"delivery" | "retirada">("delivery");
  const [payment, setPayment] = useState<"dinheiro" | "pix" | "cartao">("pix");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = type === "delivery" ? Number(settings?.delivery_fee ?? 0) : 0;
  const cardFeePct = Number(settings?.card_fee_percent ?? 0);
  const cardFee = payment === "cartao" ? +(((subtotal + deliveryFee) * cardFeePct) / 100).toFixed(2) : 0;
  const total = subtotal + deliveryFee + cardFee;

  const submit = async () => {
    const parsed = checkoutSchema.safeParse({ name, phone, type, payment, address, neighborhood, changeFor, notes });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (items.length === 0) { toast.error("Carrinho vazio"); return; }
    if (type === "delivery" && (!address.trim() || !neighborhood.trim())) {
      toast.error("Informe endereço e bairro para delivery"); return;
    }
    setSubmitting(true);
    try {
      const { data: order, error: oerr } = await supabase.from("orders").insert({
        channel: "online",
        order_type: type,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_address: type === "delivery" ? address.trim() : null,
        customer_neighborhood: type === "delivery" ? neighborhood.trim() : null,
        payment_method: payment,
        change_for: payment === "dinheiro" && changeFor ? Number(changeFor.replace(",", ".")) || null : null,
        delivery_fee: deliveryFee,
        card_fee: cardFee,
        subtotal,
        total,
        status: "novo",
        notes: notes.trim() || null,
      }).select("id").single();
      if (oerr) throw oerr;

      const { error: ierr } = await supabase.from("order_items").insert(items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.productName,
        category_id: i.categoryId,
        category_name: i.categoryName,
        size: i.size || null,
        addon_id: i.addonId || null,
        addon_name: i.addonName || null,
        addon_price: i.addonPrice,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        line_total: (i.unitPrice + i.addonPrice) * i.quantity,
        notes: i.notes || null,
      })));
      if (ierr) throw ierr;

      // Build WhatsApp message
      const lines: string[] = [];
      lines.push(`*Novo Pedido — Expresso Pizza e Esfirra*`);
      lines.push(`*Cliente:* ${name}`);
      lines.push(`*Telefone:* ${phone}`);
      lines.push(`*Tipo:* ${type === "delivery" ? "Delivery" : "Retirada"}`);
      if (type === "delivery") lines.push(`*Endereço:* ${address}, ${neighborhood}`);
      lines.push("");
      lines.push("*Itens:*");
      items.forEach((i) => {
        const sz = i.size ? ` (${i.size})` : "";
        lines.push(`• ${i.quantity}x *[${i.categoryName}]* ${i.productName}${sz} — ${brl((i.unitPrice + i.addonPrice) * i.quantity)}`);
        if (i.addonName) lines.push(`   + ${i.addonName}`);
        if (i.notes) lines.push(`   _obs: ${i.notes}_`);
      });
      lines.push("");
      lines.push(`Subtotal: ${brl(subtotal)}`);
      if (deliveryFee) lines.push(`Taxa de entrega: ${brl(deliveryFee)}`);
      if (cardFee) lines.push(`Taxa de cartão: ${brl(cardFee)}`);
      lines.push(`*Total: ${brl(total)}*`);
      lines.push("");
      lines.push(`*Pagamento:* ${payment === "dinheiro" ? "Dinheiro" : payment === "pix" ? "Pix" : "Cartão"}`);
      if (payment === "dinheiro" && changeFor) lines.push(`Troco para: ${brl(Number(changeFor.replace(",", ".")) || 0)}`);
      if (notes) lines.push(`*Obs:* ${notes}`);

      const phoneWa = phoneDigits(settings?.whatsapp_phone || "5581989757972");
      const url = `https://wa.me/${phoneWa}?text=${encodeURIComponent(lines.join("\n"))}`;
      clear();
      toast.success("Pedido enviado! Abrindo WhatsApp...");
      window.open(url, "_blank");
      nav("/");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao enviar pedido: " + (e.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <h1 className="pizza-title text-3xl text-primary">Seu Pedido</h1>

        {items.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            <Button className="mt-4" onClick={() => nav("/")}>Ver cardápio</Button>
          </Card>
        ) : (
          <>
            <Card className="p-4 space-y-3">
              {items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{i.productName}{i.size && ` (${i.size})`}</div>
                    {i.addonName && <div className="text-xs text-muted-foreground">+ {i.addonName}</div>}
                    {i.notes && <div className="text-xs text-muted-foreground italic">{i.notes}</div>}
                    <div className="text-sm text-primary font-bold mt-1">{brl((i.unitPrice + i.addonPrice) * i.quantity)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(i.id, i.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center font-semibold">{i.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(i.id, i.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="n">Nome *</Label>
                  <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="p">Telefone *</Label>
                  <Input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="(81) 9..." />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Receber como?</Label>
                <RadioGroup value={type} onValueChange={(v: any) => setType(v)} className="grid grid-cols-2 gap-2">
                  <Label className={`border rounded-md p-3 cursor-pointer flex items-center gap-2 ${type === "delivery" ? "border-primary bg-primary/5" : ""}`}>
                    <RadioGroupItem value="delivery" /> Delivery
                  </Label>
                  <Label className={`border rounded-md p-3 cursor-pointer flex items-center gap-2 ${type === "retirada" ? "border-primary bg-primary/5" : ""}`}>
                    <RadioGroupItem value="retirada" /> Retirar na loja
                  </Label>
                </RadioGroup>
              </div>

              {type === "delivery" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2"><Label>Endereço *</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="Rua, número, complemento" /></div>
                  <div className="sm:col-span-2"><Label>Bairro *</Label><Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} maxLength={100} /></div>
                </div>
              )}

              <div>
                <Label className="mb-2 block">Forma de pagamento</Label>
                <RadioGroup value={payment} onValueChange={(v: any) => setPayment(v)} className="grid grid-cols-3 gap-2">
                  {[["pix", "Pix"], ["dinheiro", "Dinheiro"], ["cartao", "Cartão"]].map(([v, l]) => (
                    <Label key={v} className={`border rounded-md p-3 cursor-pointer flex items-center gap-2 justify-center ${payment === v ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value={v} /> {l}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {payment === "dinheiro" && (
                <div><Label>Troco para</Label><Input value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="Ex: 100" /></div>
              )}

              <div>
                <Label>Observação</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} />
              </div>
            </Card>

            <Card className="p-4 space-y-1.5">
              <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
              {deliveryFee > 0 && <div className="flex justify-between"><span>Taxa de entrega</span><span>{brl(deliveryFee)}</span></div>}
              {cardFee > 0 && <div className="flex justify-between"><span>Taxa de cartão ({cardFeePct}%)</span><span>{brl(cardFee)}</span></div>}
              <div className="flex justify-between text-xl font-bold pt-2 border-t"><span>Total</span><span className="text-primary">{brl(total)}</span></div>
            </Card>

            <Button size="lg" className="w-full text-lg" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Enviar pedido pelo WhatsApp"}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

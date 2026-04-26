import { useState, useEffect, useRef } from "react";
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
import { Plus, Minus, Trash2, Loader2, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const CUSTOMER_KEY = "expresso_customer_v1";

type SavedCustomer = {
  name: string;
  phone: string;
  address: string;
  neighborhood: string;
  type: "delivery" | "retirada";
  payment: "dinheiro" | "pix" | "cartao";
};

function loadCustomer(): SavedCustomer | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCustomer(data: SavedCustomer) {
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data));
}

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  phone: z.string().trim().min(10, "Telefone invalido").max(20),
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

  const saved = loadCustomer();

  const [name, setName] = useState(saved?.name ?? "");
  const [phone, setPhone] = useState(saved?.phone ?? "");
  const [type, setType] = useState<"delivery" | "retirada">(saved?.type ?? "delivery");
  const [payment, setPayment] = useState<"dinheiro" | "pix" | "cartao">(saved?.payment ?? "pix");
  const [address, setAddress] = useState(saved?.address ?? "");
  const [neighborhood, setNeighborhood] = useState(saved?.neighborhood ?? "");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!saved);
  const [lookingUp, setLookingUp] = useState(false);
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSaved = () => {
    localStorage.removeItem(CUSTOMER_KEY);
    setName(""); setPhone(""); setAddress(""); setNeighborhood("");
    setType("delivery"); setPayment("pix");
    setHasSaved(false);
    toast.success("Dados apagados");
  };

  const handlePhoneLookup = async (rawPhone: string) => {
    const digits = phoneDigits(rawPhone);
    if (digits.length < 10) return;
    setLookingUp(true);
    try {
      const { data: prev } = await supabase
        .from("orders")
        .select("customer_name, customer_address, customer_neighborhood, order_type, payment_method")
        .eq("channel", "online")
        .eq("customer_phone", rawPhone.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prev) {
        if (prev.customer_name && !name) setName(prev.customer_name);
        if (prev.customer_address && !address) setAddress(prev.customer_address);
        if (prev.customer_neighborhood && !neighborhood) setNeighborhood(prev.customer_neighborhood);
        if (prev.order_type === "delivery" || prev.order_type === "retirada") setType(prev.order_type);
        if (prev.payment_method === "dinheiro" || prev.payment_method === "pix" || prev.payment_method === "cartao") {
          setPayment(prev.payment_method);
        }
        setHasSaved(true);
        toast.success("Dados preenchidos pelo histórico de pedidos");
      }
    } catch {
      // conveniência — falha silenciosamente
    } finally {
      setLookingUp(false);
    }
  };

  const deliveryFee = type === "delivery" ? Number(settings?.delivery_fee ?? 0) : 0;
  const cardFeePct = Number(settings?.card_fee_percent ?? 0);
  const cardFee = payment === "cartao" ? +(((subtotal + deliveryFee) * cardFeePct) / 100).toFixed(2) : 0;
  const total = subtotal + deliveryFee + cardFee;

  const submit = async () => {
    const parsed = checkoutSchema.safeParse({ name, phone, type, payment, address, neighborhood, changeFor, notes });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (items.length === 0) { toast.error("Carrinho vazio"); return; }
    if (type === "delivery" && (!address.trim() || !neighborhood.trim())) {
      toast.error("Informe endereco e bairro para delivery"); return;
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

      saveCustomer({ name: name.trim(), phone: phone.trim(), address: address.trim(), neighborhood: neighborhood.trim(), type, payment });

      const lines: string[] = [];
      lines.push(`*Novo Pedido — Expresso Pizza e Esfirra*`);
      lines.push(`*Cliente:* ${name}`);
      lines.push(`*Telefone:* ${phone}`);
      lines.push(`*Tipo:* ${type === "delivery" ? "Delivery" : "Retirada"}`);
      if (type === "delivery") lines.push(`*Endereco:* ${address}, ${neighborhood}`);
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
      if (cardFee) lines.push(`Taxa de cartao: ${brl(cardFee)}`);
      lines.push(`*Total: ${brl(total)}*`);
      lines.push("");
      lines.push(`*Pagamento:* ${payment === "dinheiro" ? "Dinheiro" : payment === "pix" ? "Pix" : "Cartao"}`);
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
            <p className="text-muted-foreground">Seu carrinho esta vazio.</p>
            <Button className="mt-4" onClick={() => nav("/")}>Ver cardapio</Button>
          </Card>
        ) : (
          <>
            {/* Itens do carrinho */}
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

            {/* Dados do cliente */}
            <Card className="p-4 space-y-4">

              {/* Banner: dados salvos */}
              {hasSaved && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                    <UserCheck className="h-4 w-4" />
                    Seus dados foram preenchidos automaticamente
                  </span>
                  <button onClick={clearSaved} className="text-emerald-600 hover:text-emerald-800">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="n">Nome *</Label>
                  <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="p">Telefone *</Label>
                  <div className="relative">
                    <Input
                      id="p"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
                        phoneDebounceRef.current = setTimeout(() => {
                          handlePhoneLookup(e.target.value);
                        }, 800);
                      }}
                      onBlur={() => handlePhoneLookup(phone)}
                      maxLength={20}
                      placeholder="(81) 9..."
                    />
                    {lookingUp && (
                      <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
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
                  <div className="sm:col-span-2">
                    <Label>Endereco *</Label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="Rua, numero, complemento" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Bairro *</Label>
                    <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} maxLength={100} />
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-2 block">Forma de pagamento</Label>
                <RadioGroup value={payment} onValueChange={(v: any) => setPayment(v)} className="grid grid-cols-3 gap-2">
                  {[["pix", "Pix"], ["dinheiro", "Dinheiro"], ["cartao", "Cartao"]].map(([v, l]) => (
                    <Label key={v} className={`border rounded-md p-3 cursor-pointer flex items-center gap-2 justify-center ${payment === v ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value={v} /> {l}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {payment === "dinheiro" && (
                <div>
                  <Label>Troco para</Label>
                  <Input value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="Ex: 100" />
                </div>
              )}

              <div>
                <Label>Observacao geral</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} />
              </div>
            </Card>

            {/* Totais */}
            <Card className="p-4 space-y-1.5">
              <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
              {deliveryFee > 0 && <div className="flex justify-between"><span>Taxa de entrega</span><span>{brl(deliveryFee)}</span></div>}
              {cardFee > 0 && <div className="flex justify-between"><span>Taxa de cartao ({cardFeePct}%)</span><span>{brl(cardFee)}</span></div>}
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total</span><span className="text-primary">{brl(total)}</span>
              </div>
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

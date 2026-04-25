import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { brl } from "@/lib/format";
import { format } from "date-fns";

const STATUS = [
  { v: "novo", l: "Novo", c: "bg-blue-500" },
  { v: "em_preparo", l: "Em preparo", c: "bg-amber-500" },
  { v: "pronto", l: "Pronto", c: "bg-emerald-500" },
  { v: "entregue", l: "Entregue", c: "bg-zinc-500" },
];

export default function OnlineOrders() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["online-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders").select("*, order_items(*)")
        .eq("channel", "online")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 8000,
  });

  if (isLoading) return <Loader2 className="animate-spin h-6 w-6 text-primary" />;

  const setStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["online-orders"] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pedidos online</h1>
      {(data || []).length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhum pedido ainda.</Card>}
      <div className="grid md:grid-cols-2 gap-3">
        {(data || []).map((o: any) => (
          <Card key={o.id} className="p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">{o.customer_name}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd/MM HH:mm")} · {o.order_type}</div>
                <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
              </div>
              <Badge className={STATUS.find((s) => s.v === o.status)?.c}>{STATUS.find((s) => s.v === o.status)?.l || o.status}</Badge>
            </div>
            {o.order_type === "delivery" && o.customer_address && (
              <div className="text-sm">{o.customer_address}, {o.customer_neighborhood}</div>
            )}
            <div className="text-sm border-t pt-2 space-y-0.5">
              {(o.order_items || []).map((i: any) => (
                <div key={i.id}>{i.quantity}x {i.product_name}{i.size ? ` (${i.size})` : ""}{i.addon_name ? ` + ${i.addon_name}` : ""}</div>
              ))}
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">{brl(Number(o.total))}</span>
            </div>
            <div className="text-xs text-muted-foreground">Pagamento: {o.payment_method}</div>
            <div className="flex gap-1 flex-wrap">
              {STATUS.map((s) => (
                <Button key={s.v} size="sm" variant={o.status === s.v ? "default" : "outline"} onClick={() => setStatus(o.id, s.v)}>{s.l}</Button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

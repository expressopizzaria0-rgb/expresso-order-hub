import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, Volume2 } from "lucide-react";
import { brl } from "@/lib/format";
import { format } from "date-fns";
import { requestNotificationPermission } from "@/hooks/useOrderNotifications";

const STATUS = [
  { v: "novo",       l: "Novo",       c: "bg-blue-500" },
  { v: "em_preparo", l: "Em preparo", c: "bg-amber-500" },
  { v: "pronto",     l: "Pronto",     c: "bg-emerald-500" },
  { v: "entregue",   l: "Entregue",   c: "bg-zinc-500" },
];

export default function OnlineOrders() {
  const qc = useQueryClient();
  const [notifPerm, setNotifPerm] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const prevCountRef = useRef<number | null>(null);
  const [highlight, setHighlight] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["online-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("channel", "online")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!data) return;
    const newCount = data.filter((o: any) => o.status === "novo").length;
    if (prevCountRef.current !== null && newCount > prevCountRef.current) {
      setHighlight(true);
      setTimeout(() => setHighlight(false), 4000);
    }
    prevCountRef.current = newCount;
  }, [data]);

  const handleEnableNotif = async () => {
    const result = await requestNotificationPermission();
    setNotifPerm(result);
  };

  if (isLoading) return <Loader2 className="animate-spin h-6 w-6 text-primary" />;

  const setStatus = async (id: string, status: any) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["online-orders"] });
    qc.invalidateQueries({ queryKey: ["pending-orders-watch"] });
  };

  const novosCount = (data || []).filter((o: any) => o.status === "novo").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Pedidos online</h1>
          {novosCount > 0 && (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold text-white bg-red-500 ${highlight ? "animate-bounce" : ""}`}>
              <Volume2 className="h-4 w-4" />
              {novosCount} novo{novosCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {notifPerm === "default" && (
          <Button variant="outline" size="sm" onClick={handleEnableNotif}
            className="text-amber-600 border-amber-400 hover:bg-amber-50">
            <Bell className="h-4 w-4 mr-1" />
            Ativar notificações no celular
          </Button>
        )}
        {notifPerm === "granted" && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <Bell className="h-3 w-3" /> Notificações ativas
          </span>
        )}
        {notifPerm === "denied" && (
          <span className="text-xs text-muted-foreground">
            Notificações bloqueadas — libere nas config. do navegador
          </span>
        )}
      </div>

      {(data || []).length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">Nenhum pedido ainda.</Card>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {(data || []).map((o: any) => {
          const isNovo = o.status === "novo";
          return (
            <Card key={o.id}
              className={`p-4 space-y-2 transition-all ${isNovo ? "border-blue-400 shadow-blue-100 shadow-md" : ""}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(o.created_at), "dd/MM HH:mm")} &middot;{" "}
                    {o.order_type === "delivery" ? "Delivery" : "Retirada"}
                  </div>
                  <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                </div>
                <Badge className={STATUS.find((s) => s.v === o.status)?.c + " text-white"}>
                  {STATUS.find((s) => s.v === o.status)?.l || o.status}
                </Badge>
              </div>

              {o.order_type === "delivery" && o.customer_address && (
                <div className="text-sm bg-muted/50 rounded px-2 py-1">
                  {o.customer_address}, {o.customer_neighborhood}
                </div>
              )}

              <div className="text-sm border-t pt-2 space-y-0.5">
                {(o.order_items || []).map((i: any) => (
                  <div key={i.id} className="flex justify-between">
                    <span>
                      {i.quantity}x {i.product_name}
                      {i.size ? ` (${i.size})` : ""}
                      {i.addon_name ? ` + ${i.addon_name}` : ""}
                    </span>
                    <span className="text-muted-foreground text-xs">{brl(Number(i.line_total))}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-bold border-t pt-1">
                <span>Total</span>
                <span className="text-primary">{brl(Number(o.total))}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Pagamento:{" "}
                {o.payment_method === "dinheiro" ? "Dinheiro" : o.payment_method === "pix" ? "Pix" : "Cartao"}
                {o.change_for ? ` · Troco p/ ${brl(Number(o.change_for))}` : ""}
              </div>
              {o.notes && (
                <div className="text-xs italic text-muted-foreground">Obs: {o.notes}</div>
              )}

              <div className="flex gap-1 flex-wrap pt-1">
                {STATUS.map((s) => (
                  <Button key={s.v} size="sm"
                    variant={o.status === s.v ? "default" : "outline"}
                    onClick={() => setStatus(o.id, s.v)}>
                    {s.l}
                  </Button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

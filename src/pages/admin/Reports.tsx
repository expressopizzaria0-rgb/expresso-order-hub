import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";
import { Download, Loader2 } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";

type Period = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

export default function Reports() {
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const range = useMemo(() => {
    const now = new Date();
    if (period === "today") return [startOfDay(now), endOfDay(now)];
    if (period === "yesterday") { const d = subDays(now, 1); return [startOfDay(d), endOfDay(d)]; }
    if (period === "7d") return [startOfDay(subDays(now, 6)), endOfDay(now)];
    if (period === "30d") return [startOfDay(subDays(now, 29)), endOfDay(now)];
    if (period === "month") return [startOfMonth(now), endOfDay(now)];
    return [startOfDay(new Date(from)), endOfDay(new Date(to))];
  }, [period, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", range[0].toISOString(), range[1].toISOString()],
    queryFn: async () => {
      const fromIso = (range[0] as Date).toISOString();
      const toIso = (range[1] as Date).toISOString();
      const { data: orders } = await supabase
        .from("orders").select("*, order_items(*)")
        .in("status", ["fechada", "entregue"])
        .gte("created_at", fromIso).lte("created_at", toIso);
      return orders || [];
    },
  });

  const stats = useMemo(() => {
    const orders = data || [];
    const byCategory: Record<string, number> = {};
    const byPayment: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    const itemsCount: Record<string, { name: string; qty: number; total: number }> = {};
    let total = 0, deliveryFees = 0, cardFees = 0;

    orders.forEach((o: any) => {
      total += Number(o.total);
      deliveryFees += Number(o.delivery_fee || 0);
      cardFees += Number(o.card_fee || 0);
      byPayment[o.payment_method] = (byPayment[o.payment_method] || 0) + Number(o.total);
      byChannel[o.channel] = (byChannel[o.channel] || 0) + Number(o.total);
      (o.order_items || []).forEach((i: any) => {
        byCategory[i.category_name] = (byCategory[i.category_name] || 0) + Number(i.line_total);
        const k = i.product_name + (i.size ? ` (${i.size})` : "");
        if (!itemsCount[k]) itemsCount[k] = { name: k, qty: 0, total: 0 };
        itemsCount[k].qty += Number(i.quantity);
        itemsCount[k].total += Number(i.line_total);
      });
    });
    if (deliveryFees > 0) byCategory["Taxa de Entrega"] = deliveryFees;
    if (cardFees > 0) byCategory["Taxa de Cartão"] = cardFees;

    const topItems = Object.values(itemsCount).sort((a, b) => b.qty - a.qty).slice(0, 10);
    return { orders, total, deliveryFees, cardFees, byCategory, byPayment, byChannel, topItems };
  }, [data]);

  const exportCsv = () => {
    const rows = [["Categoria/Grupo", "Valor", "%"]];
    Object.entries(stats.byCategory).forEach(([k, v]) => {
      rows.push([k, String(v), stats.total ? ((v / stats.total) * 100).toFixed(1) + "%" : "0%"]);
    });
    rows.push([]);
    rows.push(["Total", String(stats.total)]);
    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${format(range[0] as Date, "yyyyMMdd")}_${format(range[1] as Date, "yyyyMMdd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Relatórios</h1>

      <Card className="p-4 flex flex-wrap items-end gap-2">
        {([["today", "Hoje"], ["yesterday", "Ontem"], ["7d", "7 dias"], ["30d", "30 dias"], ["month", "Mês"], ["custom", "Personalizado"]] as [Period, string][]).map(([v, l]) => (
          <Button key={v} variant={period === v ? "default" : "outline"} size="sm" onClick={() => setPeriod(v)}>{l}</Button>
        ))}
        {period === "custom" && (
          <>
            <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </>
        )}
        <Button variant="outline" size="sm" onClick={exportCsv} className="ml-auto"><Download className="h-4 w-4 mr-1" /> CSV</Button>
      </Card>

      {isLoading ? <Loader2 className="animate-spin h-6 w-6 text-primary" /> : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground">Total vendas</div><div className="text-2xl font-bold text-primary">{brl(stats.total)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Pedidos</div><div className="text-2xl font-bold">{stats.orders.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Ticket médio</div><div className="text-2xl font-bold">{brl(stats.orders.length ? stats.total / stats.orders.length : 0)}</div></Card>
          </div>

          <Card className="p-4">
            <h2 className="font-bold mb-3">Vendas por Grupo</h2>
            <div className="space-y-2">
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                const pct = stats.total ? (v / stats.total) * 100 : 0;
                return (
                  <div key={k}>
                    <div className="flex justify-between text-sm">
                      <span>{k}</span>
                      <span className="font-bold">{brl(v)} <span className="text-muted-foreground text-xs">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="h-2 bg-secondary rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
              {Object.keys(stats.byCategory).length === 0 && <p className="text-muted-foreground text-sm">Sem vendas no período.</p>}
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-3">
            <Card className="p-4">
              <h2 className="font-bold mb-3">Por forma de pagamento</h2>
              {Object.entries(stats.byPayment).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b last:border-0"><span className="capitalize">{k}</span><span className="font-bold">{brl(v)}</span></div>
              ))}
            </Card>
            <Card className="p-4">
              <h2 className="font-bold mb-3">Por canal</h2>
              {Object.entries(stats.byChannel).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b last:border-0"><span className="capitalize">{k === "salao" ? "Salão" : "Online"}</span><span className="font-bold">{brl(v)}</span></div>
              ))}
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="font-bold mb-3">Itens mais vendidos</h2>
            {stats.topItems.map((i) => (
              <div key={i.name} className="flex justify-between py-1 border-b last:border-0 text-sm">
                <span>{i.qty}x {i.name}</span><span className="font-bold text-primary">{brl(i.total)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

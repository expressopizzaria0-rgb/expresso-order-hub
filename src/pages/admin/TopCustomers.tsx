import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, phoneDigits } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Period = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

export default function TopCustomers() {
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const range = useMemo<[Date, Date]>(() => {
    const now = new Date();
    if (period === "today") return [startOfDay(now), endOfDay(now)];
    if (period === "yesterday") { const d = subDays(now, 1); return [startOfDay(d), endOfDay(d)]; }
    if (period === "7d") return [startOfDay(subDays(now, 6)), endOfDay(now)];
    if (period === "30d") return [startOfDay(subDays(now, 29)), endOfDay(now)];
    if (period === "month") return [startOfMonth(now), endOfDay(now)];
    return [startOfDay(new Date(from)), endOfDay(new Date(to))];
  }, [period, from, to]);

  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["top-customers", range[0].toISOString(), range[1].toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("customer_phone, customer_name, total")
        .eq("channel", "online")
        .neq("status", "cancelado")
        .gte("created_at", range[0].toISOString())
        .lte("created_at", range[1].toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  const customers = useMemo(() => {
    const map: Record<string, { phone: string; name: string; count: number; total: number }> = {};
    (rawOrders || []).forEach((o: any) => {
      const key = phoneDigits(o.customer_phone || "") || o.customer_name || "desconhecido";
      if (!map[key]) {
        map[key] = {
          phone: o.customer_phone || "—",
          name: o.customer_name || "—",
          count: 0,
          total: 0,
        };
      }
      map[key].count += 1;
      map[key].total += Number(o.total);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [rawOrders]);

  const chartData = customers.slice(0, 10).map((c, i) => ({
    rank: `#${i + 1} ${c.name.split(" ")[0]}`,
    total: +c.total.toFixed(2),
  }));

  const totalReceita = customers.reduce((s, c) => s + c.total, 0);
  const totalPedidos = customers.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Melhores Clientes</h1>

      {/* Filtro de período */}
      <Card className="p-4 flex flex-wrap items-end gap-2">
        {([
          ["today", "Hoje"],
          ["yesterday", "Ontem"],
          ["7d", "7 dias"],
          ["30d", "30 dias"],
          ["month", "Mês"],
          ["custom", "Personalizado"],
        ] as [Period, string][]).map(([v, l]) => (
          <Button key={v} variant={period === v ? "default" : "outline"} size="sm" onClick={() => setPeriod(v)}>
            {l}
          </Button>
        ))}
        {period === "custom" && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
            </div>
          </>
        )}
      </Card>

      {isLoading ? (
        <Loader2 className="animate-spin h-6 w-6 text-primary" />
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Clientes únicos</div>
              <div className="text-2xl font-bold">{customers.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Total de pedidos</div>
              <div className="text-2xl font-bold">{totalPedidos}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Receita total</div>
              <div className="text-2xl font-bold text-primary">{brl(totalReceita)}</div>
            </Card>
          </div>

          {/* Gráfico — top 10 por gasto */}
          {chartData.length > 0 && (
            <Card className="p-4">
              <h2 className="font-bold mb-3">Top 10 por gasto total</h2>
              <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 42)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => brl(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="rank" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [brl(v), "Gasto total"]} />
                  <Bar dataKey="total" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Tabela completa */}
          <Card className="p-4">
            <h2 className="font-bold mb-3">Ranking completo</h2>
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 pr-3 w-8">#</th>
                      <th className="text-left py-2 pr-3">Nome</th>
                      <th className="text-left py-2 pr-3">Telefone</th>
                      <th className="text-right py-2 pr-3">Pedidos</th>
                      <th className="text-right py-2">Total gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, i) => (
                      <tr key={c.phone + c.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-3 font-bold text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3 font-medium">{c.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{c.phone}</td>
                        <td className="py-2 pr-3 text-right">{c.count}</td>
                        <td className="py-2 text-right font-bold text-primary">{brl(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { brl } from "@/lib/format";

export default function Tables() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["tables-with-totals"],
    queryFn: async () => {
      const { data: tables, error } = await supabase.from("tables").select("*").order("number");
      if (error) throw error;
      const ids = (tables || []).map((t: any) => t.id);
      const { data: openOrders } = await supabase
        .from("orders")
        .select("id, table_id, total, status")
        .eq("channel", "salao")
        .in("status", ["aberta"])
        .in("table_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const totals: Record<string, number> = {};
      const orderIds: Record<string, string> = {};
      (openOrders || []).forEach((o: any) => {
        totals[o.table_id] = (totals[o.table_id] || 0) + Number(o.total || 0);
        orderIds[o.table_id] = o.id;
      });
      return { tables: tables || [], totals, orderIds };
    },
    refetchInterval: 5000,
  });

  if (isLoading) return <Loader2 className="animate-spin h-6 w-6 text-primary" />;

  const colorFor = (status: string) =>
    status === "livre" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700"
    : status === "ocupada" ? "bg-orange-500/10 border-orange-500/40 text-orange-700"
    : "bg-amber-500/10 border-amber-500/40 text-amber-700";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mesas</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {data?.tables.map((t: any) => (
          <button key={t.id} onClick={() => nav(`/painel/mesa/${t.id}`)}
            className={`border-2 rounded-xl p-4 text-left transition hover:shadow-lg ${colorFor(t.status)}`}>
            <div className="text-xs uppercase font-semibold opacity-75">Mesa</div>
            <div className="text-4xl font-bold">{t.number}</div>
            <div className="text-xs mt-2 capitalize">{t.status}</div>
            {data.totals[t.id] > 0 && <div className="text-sm font-bold mt-1">{brl(data.totals[t.id])}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

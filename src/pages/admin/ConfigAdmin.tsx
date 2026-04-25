import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ConfigAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const [s, t, a, u] = await Promise.all([
        supabase.from("settings").select("*"),
        supabase.from("tables").select("*").order("number"),
        supabase.from("addons").select("*").order("sort_order"),
        supabase.from("user_roles").select("*"),
      ]);
      const m: Record<string,string> = {};
      (s.data || []).forEach((r:any) => m[r.key] = r.value);
      return { settings: m, tables: t.data || [], addons: a.data || [], roles: u.data || [] };
    },
  });
  const [s, setS] = useState<Record<string,string>>({});
  const [tableNum, setTableNum] = useState("");

  useEffect(() => { if (data) setS(data.settings); }, [data]);

  if (isLoading) return <Loader2 className="animate-spin h-6 w-6 text-primary" />;

  const saveSetting = async (key: string) => {
    await supabase.from("settings").upsert({ key, value: s[key] || "" });
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const addTable = async () => {
    const n = Number(tableNum);
    if (!n) return;
    await supabase.from("tables").insert({ number: n });
    setTableNum("");
    qc.invalidateQueries({ queryKey: ["config"] });
  };
  const delTable = async (id: string) => {
    if (!confirm("Excluir mesa?")) return;
    await supabase.from("tables").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["config"] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Loja & Taxas</h2>
        {[
          ["store_name", "Nome da loja"],
          ["store_address", "Endereço"],
          ["store_hours", "Horário"],
          ["whatsapp_phone", "WhatsApp (apenas dígitos com DDI 55)"],
          ["delivery_fee", "Taxa de entrega (R$)"],
          ["card_fee_percent", "Taxa de cartão (%)"],
        ].map(([k, l]) => (
          <div key={k} className="flex gap-2 items-end">
            <div className="flex-1"><Label>{l}</Label><Input value={s[k] || ""} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></div>
            <Button onClick={() => saveSetting(k)}>Salvar</Button>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Mesas</h2>
        <div className="flex flex-wrap gap-2">
          {(data?.tables || []).map((t: any) => (
            <div key={t.id} className="flex items-center gap-1 border rounded px-2 py-1">
              <span className="font-bold">Mesa {t.number}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => delTable(t.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div><Label>Nº da mesa</Label><Input type="number" value={tableNum} onChange={(e) => setTableNum(e.target.value)} /></div>
          <Button onClick={addTable}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Bordas</h2>
        {(data?.addons || []).map((a: any) => <div key={a.id} className="text-sm">• {a.name} — R$ {Number(a.price).toFixed(2)}</div>)}
        <p className="text-xs text-muted-foreground">Para editar bordas, ajuste no banco diretamente ou peça uma nova versão.</p>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Usuários</h2>
        <UsersAdmin roles={data?.roles || []} onChange={() => qc.invalidateQueries({ queryKey: ["config"] })} />
      </Card>
    </div>
  );
}

function UsersAdmin({ roles, onChange }: { roles: any[]; onChange: () => void }) {
  const [users, setUsers] = useState<{id:string;email:string|null}[]>([]);
  useEffect(() => {
    // Cannot list auth.users from client; show roles only
    setUsers(roles.map(r => ({ id: r.user_id, email: null })));
  }, [roles]);

  const setRole = async (userId: string, newRole: "admin" | "garcom") => {
    // remove any other role and insert the new one
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    toast.success("Papel atualizado");
    onChange();
  };

  return (
    <div className="space-y-1 text-sm">
      {roles.map((r: any) => (
        <div key={r.id} className="flex justify-between items-center border-b last:border-0 py-1">
          <span className="font-mono text-xs">{r.user_id.slice(0, 8)}…</span>
          <span className="text-muted-foreground">{r.role}</span>
          <div className="flex gap-1">
            <Button size="sm" variant={r.role === "admin" ? "default" : "outline"} onClick={() => setRole(r.user_id, "admin")}>Admin</Button>
            <Button size="sm" variant={r.role === "garcom" ? "default" : "outline"} onClick={() => setRole(r.user_id, "garcom")}>Garçom</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

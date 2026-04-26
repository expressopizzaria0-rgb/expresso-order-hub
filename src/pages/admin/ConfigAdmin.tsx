import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
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
      const m: Record<string, string> = {};
      (s.data || []).forEach((r: any) => (m[r.key] = r.value));
      return { settings: m, tables: t.data || [], addons: a.data || [], roles: u.data || [] };
    },
  });

  const [s, setS] = useState<Record<string, string>>({});
  const [tableNum, setTableNum] = useState("");
  const [newAddon, setNewAddon] = useState({ name: "", price: "" });
  const [editingAddon, setEditingAddon] = useState<{ id: string; name: string; price: string } | null>(null);

  useEffect(() => { if (data) setS(data.settings); }, [data]);

  if (isLoading) return <Loader2 className="animate-spin h-6 w-6 text-primary" />;

  const saveSetting = async (key: string) => {
    await supabase.from("settings").upsert({ key, value: s[key] || "" });
    toast.success("Salvo!");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const addTable = async () => {
    const n = Number(tableNum);
    if (!n || n < 1) return;
    const { error } = await supabase.from("tables").insert({ number: n });
    if (error) { toast.error("Numero ja existe"); return; }
    setTableNum("");
    qc.invalidateQueries({ queryKey: ["config"] });
    toast.success(`Mesa ${n} adicionada`);
  };

  const delTable = async (id: string, num: number) => {
    if (!confirm(`Excluir mesa ${num}?`)) return;
    await supabase.from("tables").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["config"] });
  };

  const addAddon = async () => {
    const name = newAddon.name.trim();
    const price = parseFloat(newAddon.price.replace(",", "."));
    if (!name || isNaN(price) || price <= 0) {
      toast.error("Preencha nome e preco valido");
      return;
    }
    const maxOrder = Math.max(0, ...(data?.addons || []).map((a: any) => a.sort_order));
    await supabase.from("addons").insert({ name, price, active: true, sort_order: maxOrder + 1 });
    setNewAddon({ name: "", price: "" });
    qc.invalidateQueries({ queryKey: ["config"] });
    qc.invalidateQueries({ queryKey: ["menu"] });
    toast.success("Borda adicionada");
  };

  const saveAddon = async () => {
    if (!editingAddon) return;
    const price = parseFloat(editingAddon.price.replace(",", "."));
    if (!editingAddon.name.trim() || isNaN(price)) { toast.error("Dados invalidos"); return; }
    await supabase.from("addons").update({ name: editingAddon.name.trim(), price }).eq("id", editingAddon.id);
    setEditingAddon(null);
    qc.invalidateQueries({ queryKey: ["config"] });
    qc.invalidateQueries({ queryKey: ["menu"] });
    toast.success("Borda atualizada");
  };

  const delAddon = async (id: string, name: string) => {
    if (!confirm(`Excluir borda "${name}"?`)) return;
    await supabase.from("addons").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["config"] });
    qc.invalidateQueries({ queryKey: ["menu"] });
    toast.success("Borda removida");
  };

  const setRole = async (userId: string, newRole: "admin" | "garcom") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["config"] });
  };

  const SETTINGS_FIELDS: [string, string][] = [
    ["store_name",       "Nome da loja"],
    ["store_address",    "Endereco"],
    ["store_hours",      "Horario de funcionamento"],
    ["whatsapp_phone",   "WhatsApp para pedidos (digitos com DDI — ex: 5581989757972)"],
    ["delivery_fee",     "Taxa de entrega (R$)"],
    ["card_fee_percent", "Taxa de cartao (%)"],
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Configuracoes</h1>

      {/* LOJA & TAXAS */}
      <Card className="p-5 space-y-4">
        <h2 className="font-bold text-lg">Loja &amp; Taxas</h2>
        {SETTINGS_FIELDS.map(([k, l]) => (
          <div key={k} className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">{l}</Label>
              <Input
                value={s[k] || ""}
                onChange={(e) => setS({ ...s, [k]: e.target.value })}
                placeholder={k === "whatsapp_phone" ? "5581989757972" : ""}
              />
            </div>
            <Button onClick={() => saveSetting(k)}>
              <Check className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          Altere o numero do WhatsApp aqui se trocar de numero. Nao precisa mexer no codigo.
        </p>
      </Card>

      {/* BORDAS */}
      <Card className="p-5 space-y-4">
        <h2 className="font-bold text-lg">Bordas Recheadas</h2>
        <div className="space-y-2">
          {(data?.addons || []).map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 border rounded-md p-2">
              {editingAddon?.id === a.id ? (
                <>
                  <Input className="flex-1" value={editingAddon.name}
                    onChange={(e) => setEditingAddon({ ...editingAddon, name: e.target.value })} />
                  <Input className="w-24" value={editingAddon.price} placeholder="Preco"
                    onChange={(e) => setEditingAddon({ ...editingAddon, price: e.target.value })} />
                  <Button size="icon" variant="default" onClick={saveAddon}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingAddon(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{a.name}</span>
                  <span className="text-primary font-bold">R$ {Number(a.price).toFixed(2)}</span>
                  <Button size="icon" variant="ghost"
                    onClick={() => setEditingAddon({ id: a.id, name: a.name, price: String(a.price) })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive"
                    onClick={() => delAddon(a.id, a.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end border-t pt-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Nome da borda</Label>
            <Input placeholder="Ex: Borda Catupiry" value={newAddon.name}
              onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })} />
          </div>
          <div className="w-28">
            <Label className="text-xs text-muted-foreground mb-1 block">Preco (R$)</Label>
            <Input placeholder="6,00" value={newAddon.price}
              onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })} />
          </div>
          <Button onClick={addAddon}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </div>
      </Card>

      {/* MESAS */}
      <Card className="p-5 space-y-4">
        <h2 className="font-bold text-lg">Mesas do Salao</h2>
        <div className="flex flex-wrap gap-2">
          {(data?.tables || []).map((t: any) => (
            <div key={t.id} className="flex items-center gap-1 border rounded-md px-3 py-1.5">
              <span className="font-bold text-sm">Mesa {t.number}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                onClick={() => delTable(t.id, t.number)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end border-t pt-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Numero da mesa</Label>
            <Input type="number" min={1} className="w-32" value={tableNum}
              onChange={(e) => setTableNum(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTable()} />
          </div>
          <Button onClick={addTable}><Plus className="h-4 w-4 mr-1" /> Adicionar mesa</Button>
        </div>
      </Card>

      {/* USUARIOS */}
      <Card className="p-5 space-y-3">
        <h2 className="font-bold text-lg">Usuarios e Papeis</h2>
        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          Para criar novos usuarios: Supabase Dashboard &gt; Authentication &gt; Users &gt; Add user.
          O primeiro usuario criado vira admin automaticamente.
        </p>
        {(data?.roles || []).length === 0 && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
            Nenhum usuario cadastrado. Acesse /auth e crie o primeiro — sera admin automaticamente.
          </p>
        )}
        {(data?.roles || []).map((r: any) => (
          <div key={r.id} className="flex justify-between items-center border-b last:border-0 py-2">
            <div>
              <span className="font-mono text-xs text-muted-foreground">{r.user_id.slice(0, 12)}...</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${
                r.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
              }`}>
                {r.role}
              </span>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={r.role === "admin" ? "default" : "outline"}
                onClick={() => setRole(r.user_id, "admin")}>Admin</Button>
              <Button size="sm" variant={r.role === "garcom" ? "default" : "outline"}
                onClick={() => setRole(r.user_id, "garcom")}>Garcom</Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

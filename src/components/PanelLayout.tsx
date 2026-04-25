import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutGrid, ClipboardList, UtensilsCrossed, BarChart3, Settings, LogOut, Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function PanelLayout() {
  const { user, role, loading, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  const links = [
    { to: "/painel/mesas", icon: LayoutGrid, label: "Mesas", roles: ["admin", "garcom"] },
    { to: "/painel/online", icon: ClipboardList, label: "Pedidos online", roles: ["admin", "garcom"] },
    { to: "/admin/cardapio", icon: UtensilsCrossed, label: "Cardápio", roles: ["admin"] },
    { to: "/admin/relatorios", icon: BarChart3, label: "Relatórios", roles: ["admin"] },
    { to: "/admin/config", icon: Settings, label: "Configurações", roles: ["admin"] },
  ].filter((l) => role && l.roles.includes(role));

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/painel/mesas" className="pizza-title text-2xl text-primary">EXPRESSO</Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">{user.email} · {role}</span>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); nav("/auth"); }}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
        <nav className="container mx-auto px-2 overflow-x-auto">
          <div className="flex gap-1 pb-2 min-w-max">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) => `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                <l.icon className="h-4 w-4" /> {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

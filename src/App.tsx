import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/store/cart";
import { AuthProvider } from "@/hooks/useAuth";
import Menu from "./pages/Menu";
import Checkout from "./pages/Checkout";
import Auth from "./pages/Auth";
import PanelLayout from "./components/PanelLayout";
import Tables from "./pages/panel/Tables";
import TableOrder from "./pages/panel/TableOrder";
import OnlineOrders from "./pages/panel/OnlineOrders";
import MenuAdmin from "./pages/admin/MenuAdmin";
import Reports from "./pages/admin/Reports";
import ConfigAdmin from "./pages/admin/ConfigAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Menu />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<PanelLayout />}>
                <Route path="/painel/mesas" element={<Tables />} />
                <Route path="/painel/mesa/:id" element={<TableOrder />} />
                <Route path="/painel/online" element={<OnlineOrders />} />
                <Route path="/admin" element={<Tables />} />
                <Route path="/admin/cardapio" element={<MenuAdmin />} />
                <Route path="/admin/relatorios" element={<Reports />} />
                <Route path="/admin/config" element={<ConfigAdmin />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.35].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);
    });
  } catch {}
}

export function useOrderNotifications() {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const { data: pendingOrders } = useQuery({
    queryKey: ["pending-orders-watch"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_name")
        .eq("channel", "online")
        .eq("status", "novo")
        .order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!pendingOrders) return;

    const currentIds = new Set(pendingOrders.map((o: any) => o.id));

    if (!initializedRef.current) {
      prevIdsRef.current = currentIds;
      initializedRef.current = true;
      return;
    }

    const newOrders = pendingOrders.filter((o: any) => !prevIdsRef.current.has(o.id));

    if (newOrders.length > 0) {
      playBeep();

      if (typeof Notification !== "undefined") {
        if (Notification.permission === "granted") {
          new Notification(`Novo pedido! (${newOrders.length})`, {
            body: newOrders.map((o: any) => o.customer_name || "Cliente").join(", "),
            icon: "/favicon.ico",
          });
        } else if (Notification.permission === "default") {
          Notification.requestPermission();
        }
      }
    }

    prevIdsRef.current = currentIds;
  }, [pendingOrders]);

  return {
    pendingCount: pendingOrders?.length ?? 0,
  };
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

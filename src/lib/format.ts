export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const phoneDigits = (s: string) => (s || "").replace(/\D/g, "");

export type SellerOrderSection = "new" | "ongoing" | "history";

export const sellerOrderSections: readonly { key: SellerOrderSection; label: string }[] = [
  { key: "new", label: "Novos" },
  { key: "ongoing", label: "Em andamento" },
  { key: "history", label: "Histórico" },
];

export function sellerOrderSection(status: string): SellerOrderSection {
  if (status === "awaiting_confirmation") return "new";
  if (status === "confirmed") return "ongoing";
  return "history";
}

/** Count and filter the same loaded snapshot to avoid misleading totals. */
export function sellerOrderCounts(orders: readonly { status: string }[]): Record<SellerOrderSection, number> {
  const counts = { new: 0, ongoing: 0, history: 0 };
  for (const order of orders) counts[sellerOrderSection(order.status)]++;
  return counts;
}

export function sellerOrdersInSection<T extends { status: string }>(
  orders: readonly T[],
  section: SellerOrderSection,
): T[] {
  return orders.filter(order => sellerOrderSection(order.status) === section);
}

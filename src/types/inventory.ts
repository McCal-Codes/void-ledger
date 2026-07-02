export type InventoryItem = {
  id: string;
  itemType: "prime_part" | "relic";
  name: string;
  quantity: number;
  owned: boolean;
};

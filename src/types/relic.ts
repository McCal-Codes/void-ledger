export type Relic = {
  id: string;
  owned: boolean;
  quantity: number;
  era: "Lith" | "Meso" | "Neo" | "Axi" | "Requiem";
  name: string;
  refinement: "Intact" | "Exceptional" | "Flawless" | "Radiant";
  vaulted: boolean;
  estimatedDucats: number;
  estimatedPlatinum: number;
  relicMarketPrice: number;
  expectedNetValue: number;
  recommendedAction: "Crack" | "Buy and Crack" | "Save" | "Avoid";
  imageName?: string;
  imageUrl?: string;
  sourceType?: string;
};

export type RelicReward = {
  name: string;
  rarity: "Common" | "Uncommon" | "Rare";
  dropChance: number;
  ducatValue: number;
  platValue: number;
};

export type RelicEV = {
  relicName: string;
  era: string;
  refinement: string;
  rewards: RelicReward[];
  expectedDucats: number;
  expectedPlatinum: number;
  expectedHybridValue: number;
};

import { z } from "zod";

export const settingsSchema = z.object({
  platform: z.enum(["pc", "ps4", "xb1", "switch"]),
  accountDataSource: z.enum(["manual", "alecaframe", "overwolf"]),
  currentDucats: z.number().min(0),
  currentCredits: z.number().min(0),
  averageMinutesPerRun: z.number().min(1).max(30),
  expectedDucatsPerRun: z.number().min(0).max(100),
  hoursAvailablePerDay: z.number().min(0).max(24),
  sellThreshold: z.number().min(0).max(1),
  burnThreshold: z.number().min(0).max(1),
  platToDucatConversion: z.number().min(1).max(20),
  undercutBuffer: z.number().min(0).max(10),
  relayOpenDate: z.date(),
  relayCloseDate: z.date(),
});

export const wishlistItemSchema = z.object({
  id: z.string(),
  wanted: z.boolean(),
  owned: z.boolean(),
  priority: z.enum(["Must Have", "High", "Medium", "Low", "Skip"]),
  itemName: z.string().min(1),
  category: z.string(),
  ducatCost: z.number().min(0),
  creditCost: z.number().min(0),
  quantity: z.number().min(1),
  totalDucats: z.number().min(0),
  totalCredits: z.number().min(0),
  notes: z.string().optional(),
  source: z.string(),
});

export const relicSchema = z.object({
  id: z.string(),
  owned: z.boolean(),
  quantity: z.number().min(0),
  era: z.enum(["Lith", "Meso", "Neo", "Axi", "Requiem"]),
  name: z.string().min(1),
  refinement: z.enum(["Intact", "Exceptional", "Flawless", "Radiant"]),
  vaulted: z.boolean(),
  estimatedDucats: z.number().min(0),
  estimatedPlatinum: z.number().min(0),
  relicMarketPrice: z.number().min(0),
  expectedNetValue: z.number(),
  recommendedAction: z.enum(["Crack", "Buy and Crack", "Save", "Avoid"]),
});

export const primePartSchema = z.object({
  id: z.string(),
  owned: z.boolean(),
  quantity: z.number().min(0),
  partName: z.string().min(1),
  ducatValue: z.number().min(0),
  marketPlatValue: z.number().min(0),
  platPerDucat: z.number().min(0),
  recommendation: z.enum([
    "Sell for Platinum",
    "Trade for Ducats",
    "Gray Zone",
    "Keep",
    "Protect Set",
    "Check Manually",
  ]),
  keep: z.boolean(),
  notes: z.string().optional(),
  lastPriceUpdate: z.date(),
});

export const fissureSchema = z.object({
  tier: z.string(),
  missionType: z.string(),
  node: z.string(),
  faction: z.string(),
  start: z.date(),
  end: z.date(),
  minutesRemaining: z.number().min(0),
  speedScore: z.number().min(0).max(1),
  recommended: z.boolean(),
  notes: z.string().optional(),
});

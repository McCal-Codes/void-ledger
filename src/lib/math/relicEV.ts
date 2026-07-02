import { RelicReward } from "@/types/relic";

export function calculateRelicEV(
  rewards: RelicReward[],
  refinement: string
): {
  expectedDucats: number;
  expectedPlatinum: number;
  expectedHybridValue: number;
} {
  const dropChances = getDropChances(refinement);

  const expectedDucats = rewards.reduce((sum, reward, index) => {
    return sum + (dropChances[index] * reward.ducatValue);
  }, 0);

  const expectedPlatinum = rewards.reduce((sum, reward, index) => {
    return sum + (dropChances[index] * reward.platValue);
  }, 0);

  const platToDucatConversion = 10; // Default conversion rate
  const expectedHybridValue =
    expectedDucats + expectedPlatinum * platToDucatConversion;

  return { expectedDucats, expectedPlatinum, expectedHybridValue };
}

function getDropChances(refinement: string): number[] {
  const chances: Record<string, number[]> = {
    Intact: [0.2533, 0.22, 0.11, 0.02],
    Exceptional: [0.2333, 0.24, 0.13, 0.04],
    Flawless: [0.2133, 0.26, 0.15, 0.06],
    Radiant: [0.1933, 0.28, 0.17, 0.08],
  };
  return chances[refinement] || chances["Intact"];
}

export function calculateDucatDecision(
  ducatValue: number,
  marketPlatValue: number,
  keep: boolean,
  sellThreshold: number,
  burnThreshold: number,
  protectedQuantity = 0,
  quantity = 1
): "Sell for Platinum" | "Trade for Ducats" | "Gray Zone" | "Keep" | "Protect Set" | "Check Manually" {
  if (keep) return "Keep";
  if (protectedQuantity >= quantity) return "Protect Set";
  if (ducatValue <= 0) return "Check Manually";
  if (!marketPlatValue) return "Trade for Ducats";

  const platPerDucat = marketPlatValue / ducatValue;

  if (platPerDucat >= sellThreshold) return "Sell for Platinum";
  if (platPerDucat <= burnThreshold) return "Trade for Ducats";
  return "Gray Zone";
}

export function calculateLiquidPlatEstimate(
  highestBuyOrder: number,
  medianOnlineSell: number,
  undercutBuffer: number
): number {
  return Math.max(highestBuyOrder, medianOnlineSell - undercutBuffer);
}

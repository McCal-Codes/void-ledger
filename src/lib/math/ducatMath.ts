import { WishlistItem } from "@/types/baro";

export function calculateDucatPlan(
  wishlist: WishlistItem[],
  currentDucats: number,
  currentCredits: number,
  plannedConversions: number
) {
  const totalWantedDucats = wishlist.reduce(
    (sum, item) => sum + item.totalDucats,
    0
  );
  const totalWantedCredits = wishlist.reduce(
    (sum, item) => sum + item.totalCredits,
    0
  );

  const remainingDucats = totalWantedDucats - currentDucats - plannedConversions;
  const remainingCredits = totalWantedCredits - currentCredits;

  return {
    totalWantedDucats,
    totalWantedCredits,
    remainingDucats,
    remainingCredits,
  };
}

import { useStore } from "@/lib/store/useStore";
import { fetchFissures } from "@/lib/api/warframePublicExport";
import { fetchBaroInventory, fetchRelicPrices } from "@/lib/api/tennoTools";

export async function loadRealData({ force = false }: { force?: boolean } = {}) {
  const { setIsLoading, setError, lastDataFetch, fissures } = useStore.getState();
  
  // Check if data is fresh (less than 5 minutes old)
  const DATA_FRESHNESS_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  if (
    !force &&
    fissures.length > 0 &&
    lastDataFetch &&
    Date.now() - lastDataFetch.getTime() < DATA_FRESHNESS_THRESHOLD
  ) {
    return; // Data is fresh, skip fetch
  }
  
  try {
    setIsLoading(true);
    setError(null);

    const [fissuresResult, baroItemsResult, relicPricesResult] = await Promise.allSettled([
      fetchFissures(),
      fetchBaroInventory(),
      fetchRelicPrices(),
    ]);

    const currentState = useStore.getState();
    const nextFissures =
      fissuresResult.status === "fulfilled"
        ? fissuresResult.value
        : currentState.fissures;
    const nextBaroItems =
      baroItemsResult.status === "fulfilled"
        ? baroItemsResult.value
        : currentState.baroItems;
    const nextRelicPrices =
      relicPricesResult.status === "fulfilled" ? relicPricesResult.value : currentState.relicPrices;

    if (fissuresResult.status === "rejected") {
      console.warn("Failed to refresh fissures; using cached data.", fissuresResult.reason);
    }
    if (baroItemsResult.status === "rejected") {
      console.warn("Failed to refresh Baro inventory; using cached data.", baroItemsResult.reason);
    }
    if (relicPricesResult.status === "rejected") {
      console.warn("Failed to refresh relic prices; using cached data.", relicPricesResult.reason);
    }

    useStore.setState({
      fissures: nextFissures,
      baroItems: nextBaroItems,
      relicPrices: nextRelicPrices,
      lastDataFetch: new Date(),
      error: null,
    });
  } catch (error) {
    console.error("Error loading real data: - dataService.ts:36", error);
    setError("Failed to load data. Please try again.");
    
    const currentState = useStore.getState();
    useStore.setState({
      wishlist: currentState.wishlist,
      relics: currentState.relics,
      fissures: currentState.fissures,
      baroItems: currentState.baroItems,
    });
  } finally {
    setIsLoading(false);
  }
}

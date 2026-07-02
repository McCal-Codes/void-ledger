import WorldStateClientPage from "@/app/world-state/WorldStateClientPage";
import { fetchWarframeWorldState } from "@/lib/api/warframeWorldState";

export default async function WorldStatePage() {
  const initialWorldState = await fetchWarframeWorldState();
  return <WorldStateClientPage initialWorldState={initialWorldState} />;
}

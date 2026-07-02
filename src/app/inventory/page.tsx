import InventoryClientPage from "@/app/inventory/InventoryClientPage";
import { getPrimePartAnalysis } from "@/lib/inventory/primePartAnalysis";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const initialAnalysis = await getPrimePartAnalysis({ includeMarket: true });
  return <InventoryClientPage initialAnalysis={initialAnalysis} />;
}

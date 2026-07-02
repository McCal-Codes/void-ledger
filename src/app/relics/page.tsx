import RelicsClientPage from "@/app/relics/RelicsClientPage";
import { getOverwolfInventoryStatus } from "@/lib/account/overwolfSnapshotStatus";

export const dynamic = "force-dynamic";

export default async function RelicsPage() {
  const initialAccountStatus = await getOverwolfInventoryStatus({ limit: 5000 });
  return <RelicsClientPage initialAccountStatus={initialAccountStatus} />;
}

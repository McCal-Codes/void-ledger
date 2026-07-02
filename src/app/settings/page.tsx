import SettingsClientPage from "@/app/settings/SettingsClientPage";
import { getOverwolfInventoryStatus } from "@/lib/account/overwolfSnapshotStatus";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const initialAccountStatus = await getOverwolfInventoryStatus({ limit: 0 });
  return <SettingsClientPage initialAccountStatus={initialAccountStatus} />;
}

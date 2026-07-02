import WishlistClientPage from "@/app/wishlist/WishlistClientPage";
import { getOverwolfInventoryStatus } from "@/lib/account/overwolfSnapshotStatus";

export default async function WishlistPage() {
  const initialAccountStatus = await getOverwolfInventoryStatus({ limit: 5000 });
  return <WishlistClientPage initialAccountStatus={initialAccountStatus} />;
}

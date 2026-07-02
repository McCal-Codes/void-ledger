"use client";

import Image from "next/image";
import { useState } from "react";
import { Box, CircleHelp, Gem, Package, Shield, Sparkles, Swords, WandSparkles } from "lucide-react";
import type { AccountInventoryItem } from "@/types/account";

type ItemCategory = AccountInventoryItem["category"] | string;

type Props = {
  imageUrl?: string;
  name: string;
  category: ItemCategory;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

const ICON_SIZE_CLASS = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const CATEGORY_CLASS: Record<string, string> = {
  Relic: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  "Prime Part": "border-amber-500/30 bg-amber-500/10 text-amber-200",
  Mod: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  Resource: "border-green-500/30 bg-green-500/10 text-green-200",
  Weapon: "border-red-500/30 bg-red-500/10 text-red-200",
  Warframe: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  Cosmetic: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
  Decoration: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
  "Primed Mod": "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  Other: "border-zinc-700 bg-zinc-800 text-zinc-300",
};

function CategoryIcon({ category, className }: { category: ItemCategory; className: string }) {
  switch (category) {
    case "Relic":
      return <Sparkles className={className} aria-hidden="true" />;
    case "Prime Part":
      return <Gem className={className} aria-hidden="true" />;
    case "Mod":
    case "Primed Mod":
      return <WandSparkles className={className} aria-hidden="true" />;
    case "Resource":
      return <Package className={className} aria-hidden="true" />;
    case "Weapon":
      return <Swords className={className} aria-hidden="true" />;
    case "Warframe":
      return <Shield className={className} aria-hidden="true" />;
    case "Cosmetic":
    case "Decoration":
      return <Box className={className} aria-hidden="true" />;
    default:
      return <CircleHelp className={className} aria-hidden="true" />;
  }
}

export function ItemAssetIcon({ imageUrl, category, size = "md" }: Props) {
  const [failed, setFailed] = useState(false);
  const categoryClass = CATEGORY_CLASS[category] ?? CATEGORY_CLASS.Other;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border ${SIZE_CLASS[size]} ${categoryClass}`}
    >
      {imageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt=""
          aria-hidden="true"
          fill
          sizes={size === "lg" ? "56px" : size === "md" ? "44px" : "36px"}
          className="object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <CategoryIcon category={category} className={ICON_SIZE_CLASS[size]} />
      )}
    </span>
  );
}

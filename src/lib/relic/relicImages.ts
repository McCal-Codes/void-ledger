import type { Relic } from "@/types/relic";

const WARFRAME_CDN_BASE = "https://cdn.warframestat.us/img";

const REFINEMENT_IMAGE_SUFFIX: Record<Relic["refinement"], string> = {
  Intact: "D",
  Exceptional: "A",
  Flawless: "B",
  Radiant: "C",
};

export function getRelicImageUrl(relic: Pick<Relic, "era" | "refinement">) {
  return `${WARFRAME_CDN_BASE}/Relic${relic.era}${REFINEMENT_IMAGE_SUFFIX[relic.refinement]}.png`;
}

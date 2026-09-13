import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/lib/brand-images";

export const runtime = "edge";
export const alt = "TalentBridge Platform Admin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <BrandOgCard
        product="Platform Admin"
        badge="Global Admin"
        title="Govern every TalentBridge tenant"
        subtitle="Create organizations, enable JobsNProfiles entitlement, and invite the first Administrator from one console."
      />
    ),
    { ...size },
  );
}

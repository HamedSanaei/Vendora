import type { ArtworkColor } from "@/lib/vendora/catalog";

export type { ArtworkColor };

/**
 * Vector "bag artwork" recreated from the Penpot illustrations
 * (handle + body + front pocket + zip highlight). Keeps product imagery
 * crisp without raster assets and adapts to card colour themes.
 */
const palettes: Record<ArtworkColor, { body: string; pocket: string }> = {
  jade: { body: "#006B4F", pocket: "#004D3A" },
  clay: { body: "#8B6F47", pocket: "#6E5637" },
  steel: { body: "#315E9B", pocket: "#264A79" },
};

export function BagArtwork({
  color = "jade",
  className,
}: {
  color?: ArtworkColor;
  className?: string;
}) {
  const palette = palettes[color];
  return (
    <svg
      viewBox="0 0 160 156"
      role="img"
      aria-label=""
      className={className}
      focusable="false"
    >
      <rect x="58" y="19" width="45" height="47" rx="19" fill="none" stroke={palette.pocket} strokeWidth="5" />
      <rect x="34" y="47" width="93" height="90" rx="13" fill={palette.body} />
      <rect x="49" y="61" width="63" height="3" rx="2" fill="#ffffff" opacity="0.75" />
      <rect x="45" y="94" width="71" height="23" rx="6" fill={palette.pocket} />
    </svg>
  );
}

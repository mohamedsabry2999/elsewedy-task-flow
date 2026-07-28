import logoAsset from "@/assets/elsewedy-logo.png.asset.json";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, string> = {
  xs: "h-6",
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
  xl: "h-20",
};

/**
 * Official Elsewedy Print House logo.
 * Do NOT recolor, distort, crop, or recreate — use as delivered.
 * The image auto-scales width by its natural aspect ratio.
 */
export function BrandMark({
  size = "md",
  className,
  priority = false,
}: {
  size?: Size;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={logoAsset.url}
      alt="Medhat Elsewedy Print House — دار مدحت السويدي للطباعة"
      className={cn(SIZE[size], "w-auto object-contain select-none", className)}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export const BRAND_LOGO_URL = logoAsset.url;

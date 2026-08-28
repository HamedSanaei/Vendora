import Link from "next/link";
import { BagArtwork, type ArtworkColor } from "@/components/vendora/product/bag-artwork";

/** Penpot 152×174 category tile. */
export function CategoryTile({ href, label, color, hiddenOnMobile = false }: { href: string; label: string; color: ArtworkColor; hiddenOnMobile?: boolean }) {
  return <Link href={href} className={`vd-focus group h-[174px] w-[152px] shrink-0 overflow-hidden rounded-[76px] bg-surface-soft px-3 py-[14px] hover:bg-jade-tint ${hiddenOnMobile ? "hidden lg:block" : "block"}`}><BagArtwork color={color} className="mx-auto h-[108px] w-auto transition-transform duration-300 group-hover:scale-105" /><span className="mt-[6px] flex h-[30px] w-[128px] items-center justify-center text-center text-sm font-semibold leading-[1.4] text-ink">{label}</span></Link>;
}

/** Penpot editorial promo, using the exact geometry of each responsive Home instance. */
export function EditorialPromoTile({ eyebrow, title, body, cta, color, background, accent }: { eyebrow: string; title: string; body: string; cta: string; color: ArtworkColor; background: string; accent: string }) {
  return (
    <article className={`relative h-[244px] overflow-hidden rounded-tile md:h-[206px] lg:h-[260px] lg:rounded-[20px] ${background}`}>
      <p className={`absolute left-[172px] top-[22px] m-0 flex h-[22px] w-[158px] items-center overflow-hidden text-start text-[10px] font-bold leading-[1.4] tracking-wide md:hidden lg:left-[196px] lg:top-[24px] lg:flex lg:h-[22px] lg:w-[196px] lg:text-[11px] ${accent}`}>
        {eyebrow}
      </p>
      <h3 className="absolute left-[150px] top-[48px] m-0 line-clamp-2 h-[58px] w-[180px] overflow-hidden text-start text-[19px] font-bold leading-[1.4] text-ink md:left-[154px] md:top-[34px] md:w-[166px] md:text-[18px] lg:left-[188px] lg:top-[54px] lg:h-[56px] lg:w-[204px] lg:text-[20px]">
        {title}
      </h3>
      <p className="absolute left-[150px] top-[110px] m-0 line-clamp-3 h-[56px] w-[180px] overflow-hidden text-start text-[12px] font-normal leading-[1.4] text-vd-muted md:hidden lg:left-[188px] lg:top-[112px] lg:block lg:h-[52px] lg:w-[204px] lg:text-[13px]">
        {body}
      </p>
      <span className="absolute left-[222px] top-[188px] m-0 flex h-[26px] w-[108px] items-center overflow-hidden text-start text-[13px] font-bold leading-[1.4] text-jade md:left-[210px] md:top-[124px] md:w-[110px] lg:left-[230px] lg:top-[190px] lg:h-[28px] lg:w-[162px]">
        {cta} ←
      </span>

      <div className="pointer-events-none absolute left-[16px] top-[48px] h-[132px] w-[124px] opacity-90 md:top-[32px] md:h-[120px] lg:left-[24px] lg:top-[64px] lg:h-[132px] lg:w-[140px]">
        <BagArtwork color={color} className="h-full w-full" />
      </div>
    </article>
  );
}

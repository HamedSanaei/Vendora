"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  bagProducts,
  categoryCircles,
  popularProductIds,
  newestProductIds,
  type ArtworkColor,
} from "@/lib/vendora/catalog";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { SectionHeading } from "@/components/vendora/ui/section-heading";
import { CategoryTile, EditorialPromoTile } from "./commerce-components";
import { ProductCard } from "@/components/vendora/product/product-card";
import { BagArtwork } from "@/components/vendora/product/bag-artwork";
import { VendoraButton } from "@/components/vendora/ui/button";
import {
  QualityIcon,
  StoreIcon,
  SupportIcon,
  TruckIcon,
} from "@/components/vendora/icons";

/** Hook returning the active locale + dictionary inside client sections. */
function useVendoraLocale() {
  const pathname = usePathname();
  const locale: Locale = getLocaleFromPathname(pathname);
  return { locale, t: getDict(locale) };
}

/**
 * Hero section (Penpot "Layout / Hero"): rounded image panel with the
 * direct-from-factory badge, display headline, body copy, primary/secondary
 * buttons and the slider pagination indicator.
 */
export function HeroSection() {
  const { locale, t } = useVendoraLocale();
  return (
    <section aria-labelledby="vd-hero-title" className="vd-container mt-[24px] md:mt-[28px] md:h-[410px] lg:mt-[31px] lg:h-[520px]">
      <div className="relative h-[510px] overflow-hidden rounded-hero bg-white md:h-[410px] md:bg-surface-soft lg:h-[480px]">
        <Image
          src="/assets/img/vendora/hero-bags.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1312px"
          className="h-[248px]! object-cover object-center md:h-auto!"
        />
        <div className="absolute inset-x-0 top-0 hidden h-full bg-gradient-to-l from-white/95 via-white/80 to-transparent rtl:bg-gradient-to-r md:block" />
        <div className="relative flex h-full flex-col px-[26px] pt-[270px] md:justify-center md:px-[44px] md:py-[28px] lg:min-h-[510px] lg:px-14 lg:py-10">
          <span className="inline-flex w-fit items-center rounded-full bg-jade-tint px-3 py-1 text-xs font-semibold text-jade">
            {t.home.heroBadge}
          </span>
          <h1 id="vd-hero-title" className="mt-[12px] max-w-xl whitespace-pre-line text-[28px] font-bold leading-[43px] text-ink lg:mt-4 lg:text-[48px] lg:leading-[1.4]">
            {t.home.heroTitle}
          </h1>
          <p className="mt-[6px] max-w-lg text-[14px] leading-[26px] text-vd-muted lg:mt-4 lg:text-[1.0625rem] lg:leading-8">{t.home.heroBody}</p>
          <div className="mt-[6px] flex flex-wrap gap-4 lg:mt-7">
            <VendoraButton href={withLocalePath("/shop", locale)} size="lg">
              {t.home.heroPrimary}
            </VendoraButton>
            <VendoraButton href={withLocalePath("/about", locale)} variant="outline" size="lg" className="hidden lg:inline-flex">
              {t.home.heroSecondary}
            </VendoraButton>
          </div>
        </div>
      </div>
      {/* Slider indicator (design shows slide 1 of 4 active) */}
      <div className="hidden h-[40px] items-center justify-between lg:flex">
        <span className="vd-text-caption font-semibold text-vd-muted">01 / 04</span>
        <div className="flex items-center gap-2" aria-hidden>
          <span className="h-1 w-8 rounded-sm bg-jade" />
          <span className="h-1 w-5 rounded-sm bg-[#bfc9c3]" />
          <span className="h-1 w-5 rounded-sm bg-[#bfc9c3]" />
          <span className="h-1 w-5 rounded-sm bg-[#bfc9c3]" />
        </div>
      </div>
    </section>
  );
}

const quickTileColors = ["bg-tile-mint", "bg-tile-sand", "bg-tile-steel"] as const;
const quickTileArtwork: ArtworkColor[] = ["jade", "clay", "steel"];

/** Three category quick-link tiles under the hero. */
export function QuickLinksSection() {
  const { locale, t } = useVendoraLocale();
  const targets = ["/shop", "/shop", "/shop", "/shop"];
  return (
    <section aria-label={t.home.quickLinks.map((q) => q.title).join(" · ")} className="vd-container mt-[40px] pb-[15px] md:mt-[28px] md:pb-0 lg:mt-[32px]">
      <h2 className="mb-[12px] text-[24px] font-bold leading-[42px] md:hidden">{locale === "fa" ? "انتخاب سریع" : "Quick picks"}</h2>
      <div className="flex gap-[14px] overflow-x-auto pb-[10px] md:grid md:h-[374px] md:grid-cols-2 md:gap-x-[16px] md:gap-y-[21px] md:overflow-visible md:pb-0 lg:h-auto lg:grid-cols-3 lg:gap-[20px]">
      {[...t.home.quickLinks, { title: locale === "fa" ? "کیف دوشی" : "Shoulder bags", subtitle: locale === "fa" ? "سبک و روزمره" : "Light everyday carry", cta: t.common.view }].map((tile, index) => (
        <Link
          key={tile.title}
          href={withLocalePath(targets[index], locale)}
          className={`vd-focus group relative flex h-[160px] w-[226px] shrink-0 flex-col justify-center overflow-hidden rounded-tile p-[20px] md:h-[174px] md:w-auto lg:h-[182px] lg:p-[24px] ${index === 3 ? "lg:hidden" : ""} ${quickTileColors[index % 3]}`}
        >
          <p className="text-[1.375rem] font-bold leading-9 text-ink">{tile.title}</p>
          <p className="mt-0.5 text-sm text-vd-muted">{tile.subtitle}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-[0.8125rem] font-bold text-jade group-hover:text-jade-dark">
            {tile.cta} ←
          </span>
          <BagArtwork
            color={quickTileArtwork[index % 3]}
            className="pointer-events-none absolute -mb-4 hidden w-[150px] opacity-90 transition-transform duration-300 group-hover:scale-105 sm:block end-6 top-1/2 -translate-y-1/2"
          />
        </Link>
      ))}
      </div>
    </section>
  );
}

/** Horizontal product row bound to a set of catalog ids. */
export function ProductRowSection({
  title,
  ids,
  artworkColors,
}: {
  title: string;
  ids: string[];
  artworkColors?: ArtworkColor[];
}) {
  const { locale, t } = useVendoraLocale();
  const products = ids.map((id) => bagProducts.find((p) => p.id === id)).filter(Boolean);
  const isNewest = ids === newestProductIds;
  return (
    <section className={`vd-container ${isNewest ? "mt-[44px] md:mt-[48px] lg:mt-[56px]" : "mt-[33px] md:mt-[48px]"}`}>
      <SectionHeading
        compact
        title={title}
        mobileTitle={locale === "fa" ? (isNewest ? "تازه‌ها" : "پرفروش‌ها") : (isNewest ? "New arrivals" : "Best sellers")}
        linkLabel={t.common.viewAll}
        linkHref={withLocalePath("/shop", locale)}
      />
      <div className="mt-[10px] grid grid-cols-2 gap-[16px] md:mt-[14px] md:grid-cols-3 md:gap-[28px] lg:mt-[16px] lg:grid-cols-5">
        {products.map(
          (product, index) =>
            product ? (
              <div key={product.id} className={`h-[324px] w-[166px] md:h-[360px] md:w-[216px] lg:h-[386px] lg:w-auto ${index >= 4 ? "hidden lg:block" : index >= 3 ? "md:hidden lg:block" : ""}`}>
                <ProductCard
                  product={product}
                  locale={locale}
                  artworkColor={artworkColors?.[index % (artworkColors.length || 1)] ?? "jade"}
                />
              </div>
            ) : null,
        )}
      </div>
    </section>
  );
}

export function PopularProductsSection() {
  const { t } = useVendoraLocale();
  return (
    <ProductRowSection
      title={t.home.popularTitle}
      ids={popularProductIds}
      artworkColors={["jade", "clay", "steel", "jade", "clay"]}
    />
  );
}

export function NewestProductsSection() {
  const { t } = useVendoraLocale();
  return (
    <ProductRowSection
      title={t.home.newestTitle}
      ids={newestProductIds}
      artworkColors={["steel", "jade", "clay", "steel", "jade"]}
    />
  );
}

const benefitIcons = [
  { Icon: TruckIcon },
  { Icon: QualityIcon },
  { Icon: StoreIcon },
  { Icon: SupportIcon },
];

/** Dark benefits strip (Penpot "Layout / Benefits"). */
export function BenefitsSection() {
  const { t } = useVendoraLocale();
  return (
    <section aria-label={t.home.benefits.map((b) => b.title).join(" · ")} className="vd-container mt-[34px] md:mt-[36px] lg:mt-[40px]">
      <div className="grid h-[220px] grid-cols-2 gap-[8px] rounded-tile bg-ink p-[10px] md:h-[212px] md:gap-x-[8px] md:gap-y-[16px] md:p-[12px] lg:h-[118px] lg:grid-cols-4 lg:gap-0 lg:px-6 lg:py-7">
        {t.home.benefits.map((benefit, index) => {
          const { Icon } = benefitIcons[index];
          return (
            <div key={benefit.title} className="flex h-[94px] items-start gap-[10px] p-[10px] md:h-[82px] lg:h-auto lg:gap-4 lg:p-0">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-control bg-white/5 text-jade-glow">
                <Icon size={24} />
              </span>
              <div>
                <p className="text-base font-bold leading-8 text-white">{benefit.title}</p>
                <p className="vd-text-caption text-on-dark-muted">{benefit.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const promoStyles = [
  { bg: "bg-promo-green", accent: "text-jade" },
  { bg: "bg-promo-clay", accent: "text-clay-accent" },
  { bg: "bg-tile-steel", accent: "text-pine" },
];
const promoArtwork: ArtworkColor[] = ["jade", "clay", "steel"];

/** Editorial promo cards ("VENDORA JOURNAL"). */
export function EditorialPromosSection() {
  const { t } = useVendoraLocale();
  const promos = [...t.home.promos, { eyebrow: "VENDORA", title: t.home.storyTitle, body: t.home.storyBody, cta: t.common.view }];
  return (
    <section aria-label={t.home.promos.map((p) => p.title).join(" · ")} className="vd-container mt-[32px] grid gap-[20px] md:mt-[64px] md:h-[444px] md:grid-cols-2 md:grid-rows-[206px_206px] md:content-start md:gap-x-[16px] md:gap-y-[24px] lg:mt-[61px] lg:h-[260px] lg:grid-cols-[repeat(3,425px)] lg:grid-rows-[260px] lg:!gap-[18px] lg:!ps-[65px] lg:!pe-[64px]">
      {promos.map((promo, index) => (
        <div key={`${promo.title}-${index}`} className={`${index > 0 ? "hidden md:block" : ""} ${index === 3 ? "lg:hidden" : ""}`}><EditorialPromoTile eyebrow={promo.eyebrow} title={promo.title} body={promo.body} cta={promo.cta} color={promoArtwork[index % 3]} background={promoStyles[index % 3].bg} accent={promoStyles[index % 3].accent} /></div>
      ))}
    </section>
  );
}

/** Category circle row (8 categories, pill-shaped tiles). */
export function CategoryCirclesSection() {
  const { locale, t } = useVendoraLocale();
  return (
    <section className="vd-container mt-[42px] md:hidden lg:mt-[54px] lg:block">
      <SectionHeading
        compact
        title={t.home.categoriesTitle}
        mobileTitle={locale === "fa" ? "دسته‌بندی‌ها" : "Categories"}
        linkLabel={t.common.viewAll}
        linkHref={withLocalePath("/shop", locale)}
      />
      <div className="mt-[10px] grid h-[362px] grid-cols-2 justify-items-center gap-[16px] lg:flex lg:h-[176px] lg:justify-between lg:overflow-visible">
        {categoryCircles.map((cat, index) => (
          <CategoryTile key={cat.key} href={withLocalePath(cat.href, locale)} label={locale === "fa" ? cat.label : cat.labelEn} color={(["jade", "clay", "steel"] as const)[index % 3]} hiddenOnMobile={index >= 4} />
        ))}
      </div>
    </section>
  );
}

/** Dark jade brand story band with the workshop narrative and CTA. */
export function BrandStorySection() {
  const { locale, t } = useVendoraLocale();
  return (
    <section aria-labelledby="vd-story-title" className="vd-container mt-[38px] md:mt-[46px] lg:mt-[64px]">
      <div className="relative flex h-[250px] flex-col gap-0 overflow-hidden rounded-hero bg-jade-dark px-[26px] py-[28px] md:h-[300px] md:flex-row md:items-center md:justify-between md:px-14 md:py-10 lg:h-[326px]">
        <div className="max-w-xl text-right">
          <p className="hidden text-sm font-bold text-jade-glow md:block">{t.home.storyEyebrow}</p>
          <h2 id="vd-story-title" className="text-[24px] font-bold leading-[48px] text-white md:mt-3 md:text-[2rem] md:leading-9">
            {t.home.storyTitle}
          </h2>
          <p className="mt-[6px] text-[14px] leading-[32px] text-on-dark-soft md:mt-3 md:text-base md:leading-8">{t.home.storyBody}</p>
          <div className="mt-[30px] flex justify-center md:mt-6 md:justify-start">
            <VendoraButton href={withLocalePath("/about", locale)} variant="primary" className="bg-white! text-jade-dark! hover:bg-jade-tint!" size="lg">
              {t.home.storyCta}
            </VendoraButton>
          </div>
        </div>
        <BagArtwork
          color="steel"
          className="mx-auto hidden w-[390px] opacity-95 md:block"
        />
      </div>
    </section>
  );
}

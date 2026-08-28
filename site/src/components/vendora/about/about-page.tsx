"use client";

import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { BagArtwork } from "@/components/vendora/product/bag-artwork";
import { StoreFooter } from "@/components/vendora/layout/store-footer";
import { StoreHeader } from "@/components/vendora/layout/store-chrome";
import { VendoraButton } from "@/components/vendora/ui/button";
import { SectionHeading } from "@/components/vendora/ui/section-heading";
import {
  CheckIcon,
  QualityIcon,
  StoreIcon,
  SupportIcon,
  TruckIcon,
  type VendoraIconProps,
} from "@/components/vendora/icons";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { getDict } from "@/lib/vendora/i18n";

const principleIcons: ComponentType<VendoraIconProps>[] = [
  StoreIcon,
  QualityIcon,
  CheckIcon,
  SupportIcon,
];

const valueIcons: ComponentType<VendoraIconProps>[] = [QualityIcon, StoreIcon, CheckIcon];

/** Reuses the catalog bag vector inside the manufacturing illustration from the approved About frame. */
function FactoryArtwork({ label, stages }: { label: string; stages: string[] }) {
  return (
    <div className="relative flex h-full min-h-[224px] flex-col overflow-hidden rounded-hero bg-jade-tint px-4 pb-4 pt-5 sm:min-h-[300px] sm:px-7 lg:min-h-[360px]">
      {label ? <p className="text-end text-xs font-bold text-jade sm:text-sm">{label}</p> : null}
      <BagArtwork color="jade" className="mx-auto min-h-0 w-[58%] max-w-[240px] flex-1" />
      {stages.length > 0 ? (
        <div className="relative grid grid-cols-4 gap-1 border-t-2 border-jade-dark/80 pt-3" aria-label={stages.join("، ")}>
          {stages.map((stage, index) => (
            <div key={stage} className="relative text-center">
              <span className="absolute -top-[22px] left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-jade bg-white text-[10px] font-bold text-jade">
                {index + 1}
              </span>
              <span className="text-[10px] font-semibold text-jade-dark sm:text-xs">{stage}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Compact repeated principle card; its data comes from the centralized locale dictionary. */
function PrincipleCard({ icon: Icon, title, body }: { icon: ComponentType<VendoraIconProps>; title: string; body: string }) {
  return (
    <article className="flex min-h-[104px] items-center gap-4 rounded-panel border border-vd-line bg-white p-5">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-jade-tint text-jade">
        <Icon size={24} />
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-bold leading-8 text-ink">{title}</h3>
        <p className="text-xs leading-6 text-vd-muted">{body}</p>
      </div>
    </article>
  );
}

/** Numbered manufacturing step shared by every responsive grid. */
function ProcessCard({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <article className="min-h-[182px] rounded-tile border border-vd-line bg-white p-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-jade-tint text-xl font-extrabold text-jade">{number}</span>
      <h3 className="mt-3 text-[17px] font-bold leading-8 text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-vd-muted">{body}</p>
    </article>
  );
}

/** Reusable brand-value card matching the soft 326×196 Penpot component. */
function ValueCard({ icon: Icon, title, body }: { icon: ComponentType<VendoraIconProps>; title: string; body: string }) {
  return (
    <article className="min-h-[196px] rounded-hero bg-surface-soft p-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-vd-line bg-white text-jade">
        <Icon size={23} />
      </span>
      <h3 className="mt-3 text-[17px] font-bold leading-8 text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-vd-muted">{body}</p>
    </article>
  );
}

/** Approved Penpot About page, composed from existing Vendora primitives and responsive grids. */
export function AboutPage() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const copy = getDict(locale).about;
  const shopHref = withLocalePath("/shop", locale);

  return (
    <div className="vd-root vd-about min-h-screen bg-white" dir={locale === "fa" ? "rtl" : "ltr"}>
      <StoreHeader />
      <main>
        <section className="vd-container mt-6 md:mt-8" aria-labelledby="vd-about-title">
          <div className="grid overflow-hidden rounded-hero border border-vd-line bg-white p-4 sm:p-8 md:min-h-[500px] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-8 lg:min-h-[520px] lg:px-12">
            <div className="h-[224px] sm:h-[300px] md:col-start-2 md:row-start-1 md:h-[360px]">
              <FactoryArtwork label={copy.artworkLabel} stages={copy.artworkStages} />
            </div>
            <div className="mt-7 md:col-start-1 md:row-start-1 md:mt-0">
              <p className="text-sm font-bold text-jade">{copy.eyebrow}</p>
              <h1 id="vd-about-title" className="mt-2 text-[26px] font-extrabold leading-[1.65] text-ink sm:text-[32px] lg:text-[42px] lg:leading-[1.55]">
                {copy.title}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-8 text-vd-muted lg:text-base">{copy.body}</p>
              <p className="mt-4 text-xs font-bold leading-7 text-jade lg:text-[13px]">{copy.promise}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <VendoraButton href={shopHref} className="w-full sm:w-auto sm:min-w-[188px]">{copy.primaryCta}</VendoraButton>
                <VendoraButton href="#production-process" variant="outline" className="hidden min-w-[188px] sm:inline-flex">{copy.secondaryCta}</VendoraButton>
              </div>
            </div>
          </div>
        </section>

        <section className="vd-container mt-10 md:mt-12" aria-labelledby="vd-about-principles">
          <SectionHeading title={copy.principlesTitle} headingId="vd-about-principles" />
          <div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4 xl:gap-10">
            {copy.principles.map((item, index) => (
              <PrincipleCard key={item.title} icon={principleIcons[index]} title={item.title} body={item.body} />
            ))}
          </div>
        </section>

        <section className="vd-container mt-12 md:mt-14">
          <div className="grid gap-6 rounded-hero bg-surface-soft p-6 md:p-10 lg:min-h-[320px] lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)] lg:items-center lg:gap-12 lg:p-12">
            <blockquote className="rounded-tile border border-vd-line bg-white p-6 text-[15px] font-bold leading-9 text-jade-dark md:text-base lg:col-start-1 lg:row-start-1 lg:p-8 lg:text-[17px]">
              {copy.narrativeQuote}
            </blockquote>
            <div className="lg:col-start-2 lg:row-start-1">
              <p className="text-sm font-bold text-jade">{copy.narrativeEyebrow}</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-[1.7] text-ink md:text-[28px] lg:text-[30px]">{copy.narrativeTitle}</h2>
              <p className="mt-3 text-sm leading-8 text-vd-muted md:text-[15px]">{copy.narrativeBody}</p>
            </div>
          </div>
        </section>

        <section id="production-process" className="vd-container mt-12 scroll-mt-6 md:mt-14" aria-labelledby="vd-about-process">
          <SectionHeading title={copy.processTitle} headingId="vd-about-process" />
          <div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-5 xl:grid-cols-4 xl:gap-10">
            {copy.process.map((item) => (
              <ProcessCard key={item.number} number={item.number} title={item.title} body={item.body} />
            ))}
          </div>
        </section>

        <section className="vd-container mt-12 md:mt-14" aria-labelledby="vd-about-values">
          <SectionHeading title={copy.valuesTitle} mobileTitle={copy.valuesShortTitle} headingId="vd-about-values" />
          <div className="mx-auto mt-3 grid max-w-[1210px] gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 xl:gap-20">
            {copy.values.map((item, index) => (
              <ValueCard key={item.title} icon={valueIcons[index]} title={item.title} body={item.body} />
            ))}
          </div>
        </section>

        <section className="vd-container mt-14 md:mt-16">
          <div className="relative overflow-hidden rounded-hero bg-jade-dark px-6 py-8 text-center md:min-h-[292px] md:px-12 md:py-9 md:text-start lg:min-h-[260px] lg:pe-[48%]">
            <div className="pointer-events-none absolute bottom-4 hidden h-[224px] w-[326px] items-center justify-center rounded-hero bg-jade-tint lg:flex end-20">
              <BagArtwork color="jade" className="h-[156px] w-[160px] shrink-0" />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold text-jade-glow md:text-sm">{copy.ctaEyebrow}</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-[1.7] text-white md:max-w-xl md:text-[30px]">{copy.ctaTitle}</h2>
              <p className="mt-2 text-[13px] leading-7 text-on-dark-soft md:text-sm">{copy.ctaBody}</p>
              <VendoraButton href={shopHref} className="mt-6 w-full bg-white! text-jade-dark! hover:bg-jade-tint! sm:w-auto sm:min-w-[188px]">
                {copy.ctaButton}
              </VendoraButton>
            </div>
          </div>
        </section>
      </main>
      <StoreFooter />
    </div>
  );
}

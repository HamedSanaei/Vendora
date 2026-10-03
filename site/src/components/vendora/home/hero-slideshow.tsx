"use client";

import Image from "next/image";
import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronIcon, PauseIcon, PlayIcon } from "@/components/vendora/icons";
import { VendoraButton } from "@/components/vendora/ui/button";
import { withLocalePath } from "@/lib/locale-path";
import { getSlideshow, type SlideshowSlideDto } from "@/lib/slideshow-api";
import { formatNumber, localizeDigits } from "@/lib/vendora/format";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";

interface HeroSlideshowProps {
  locale: Locale;
}

const fallbackImage = "/assets/img/vendora/hero-bags.jpg";
const controlClass = "vd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-jade hover:bg-jade-tint";

/** Displays API-configured hero photos without changing the original localized copy, crop or layout. */
export function HeroSlideshow({ locale }: HeroSlideshowProps) {
  const t = getDict(locale).home;
  const controls = t.slideshow;
  const [slides, setSlides] = useState<SlideshowSlideDto[]>([]);
  // A new cursor object also restarts the duration when the current indicator is selected again.
  const [cursor, setCursor] = useState({ index: 0 });
  const [autoplay, setAutoplay] = useState(false);
  const [tabHidden, setTabHidden] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const photoCount = Math.max(slides.length, 1);
  const hasMultiple = slides.length > 1;
  const activeSlide = slides[cursor.index];
  const durationSeconds = activeSlide?.durationSeconds;
  const isRunning = hasMultiple && autoplay && !tabHidden && !hovered && !focused;
  const imageUrl = activeSlide?.imageUrl ?? fallbackImage;
  const currentNumber = formatNumber(cursor.index + 1, locale);
  const totalNumber = formatNumber(photoCount, locale);
  const positionLabel = controls.position(currentNumber, totalNumber);

  // Keep the original photo for an empty configuration or unavailable API; cancel requests on unmount.
  useEffect(() => {
    const controller = new AbortController();
    getSlideshow(controller.signal)
      .then(setSlides)
      .catch(() => {
        if (!controller.signal.aborted) setSlides([]);
      });
    return () => controller.abort();
  }, []);

  // Start only after reading the client's motion preference; hidden tabs never advance the slideshow.
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAutoplay(!motion.matches);
    setTabHidden(document.hidden);
    /** Updates the visibility pause without changing the user's explicit autoplay choice. */
    function onVisibilityChange() {
      setTabHidden(document.hidden);
    }
    /** Stops autoplay when reduced motion becomes preferred; only explicit Play can start it again. */
    function onMotionChange(event: MediaQueryListEvent) {
      if (event.matches) setAutoplay(false);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    motion.addEventListener("change", onMotionChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  // One timeout per active photo honors its own duration and resets after navigation or a temporary pause.
  useEffect(() => {
    if (!isRunning || durationSeconds === undefined) return;
    const timer = window.setTimeout(() => {
      setCursor((current) => ({ index: (current.index + 1) % photoCount }));
    }, durationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [cursor, durationSeconds, isRunning, photoCount]);

  /** Selects a wrapped photo index and restarts its full display duration, including repeat selections. */
  function selectPhoto(index: number) {
    const wrappedIndex = (index + photoCount) % photoCount;
    setCursor({ index: wrappedIndex });
  }

  /** Navigates with physical arrow keys mapped to the locale's reading direction. */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!hasMultiple || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextKey = locale === "fa" ? "ArrowLeft" : "ArrowRight";
    selectPhoto(cursor.index + (event.key === nextKey ? 1 : -1));
  }

  return (
    <section
      aria-labelledby="vd-hero-title"
      aria-roledescription={controls.carousel}
      className="vd-container relative mt-[24px] md:mt-[28px] md:h-[410px] lg:mt-[31px] lg:h-[520px]"
      onKeyDown={onKeyDown}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="relative min-h-[510px] overflow-hidden rounded-hero bg-white md:h-[410px] md:min-h-0 md:bg-surface-soft lg:h-[480px]">
        {/* Only the active image is mounted; no hidden slide can contain focusable content. */}
        <div role="group" aria-roledescription={controls.photo} aria-label={positionLabel} className="absolute inset-0">
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            unoptimized={imageUrl.includes("/uploads/")}
            sizes="(max-width: 768px) 100vw, 1312px"
            className="h-[248px]! object-cover object-center md:h-auto!"
          />
        </div>
        <div className="absolute inset-x-0 top-0 hidden h-full bg-gradient-to-l from-white/95 via-white/80 to-transparent rtl:bg-gradient-to-r md:block" />
        <div className="relative flex flex-col px-[26px] pb-[26px] pt-[270px] md:h-full md:justify-center md:px-[44px] md:py-[28px] lg:min-h-[510px] lg:px-14 lg:py-10">
          <span className="inline-flex w-fit items-center rounded-full bg-jade-tint px-3 py-1 text-xs font-semibold text-jade">
            {t.heroBadge}
          </span>
          <h1 id="vd-hero-title" className="mt-[12px] max-w-xl whitespace-pre-line text-[28px] font-bold leading-[43px] text-ink lg:mt-4 lg:text-[48px] lg:leading-[1.4]">
            {t.heroTitle}
          </h1>
          <p className="mt-[6px] max-w-lg text-[14px] leading-[26px] text-vd-muted lg:mt-4 lg:text-[1.0625rem] lg:leading-8">{t.heroBody}</p>
          <div className="mt-[6px] flex flex-wrap gap-4 lg:mt-7">
            <VendoraButton href={withLocalePath("/shop", locale)} size="lg">
              {t.heroPrimary}
            </VendoraButton>
            <VendoraButton href={withLocalePath("/about", locale)} variant="outline" size="lg" className="hidden! lg:inline-flex!">
              {t.heroSecondary}
            </VendoraButton>
          </div>
        </div>
      </div>
      <div className={`${hasMultiple ? "flex" : "hidden lg:flex"} absolute inset-x-[28px] top-[194px] h-11 items-center gap-1 rounded-control bg-white/95 px-2 md:inset-x-[44px] md:bottom-3 md:top-auto lg:static lg:h-[40px] lg:gap-2 lg:rounded-none lg:bg-transparent lg:px-0`}>
        <span aria-live={isRunning ? "off" : "polite"} aria-atomic="true" className="vd-text-caption shrink-0 font-semibold text-vd-muted">
          <span className="sr-only">{positionLabel}</span>
          <span aria-hidden="true" dir="ltr">{localizeDigits(String(cursor.index + 1).padStart(2, "0"), locale)} / {localizeDigits(String(photoCount).padStart(2, "0"), locale)}</span>
        </span>
        {hasMultiple ? (
          <>
            <button type="button" className={`${controlClass} lg:ms-auto`} aria-label={controls.previous} onClick={() => selectPhoto(cursor.index - 1)}>
              <ChevronIcon size={20} className="rotate-180" />
            </button>
            <div role="group" aria-label={controls.indicators} className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto lg:max-w-md lg:flex-none">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={controls.goToPhoto(formatNumber(index + 1, locale))}
                  aria-current={index === cursor.index ? "true" : undefined}
                  onClick={() => selectPhoto(index)}
                  className={`vd-focus flex h-11 shrink-0 items-center justify-center rounded-sm ${index === cursor.index ? "w-8" : "w-5"}`}
                >
                  <span className={`h-1 w-full rounded-sm ${index === cursor.index ? "bg-jade" : "bg-[#bfc9c3]"}`} />
                </button>
              ))}
            </div>
            <button type="button" className={controlClass} aria-label={controls.next} onClick={() => selectPhoto(cursor.index + 1)}>
              <ChevronIcon size={20} />
            </button>
            <button type="button" className={controlClass} aria-label={autoplay ? controls.pause : controls.play} onClick={() => setAutoplay((playing) => !playing)}>
              {autoplay ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </button>
          </>
        ) : <span aria-hidden="true" className="ms-auto h-1 w-8 rounded-sm bg-jade" />}
      </div>
    </section>
  );
}

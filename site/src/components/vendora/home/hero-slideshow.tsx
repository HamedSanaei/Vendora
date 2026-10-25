"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectFade, Mousewheel } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import { ChevronIcon, PauseIcon, PlayIcon } from "@/components/vendora/icons";
import { VendoraButton } from "@/components/vendora/ui/button";
import { withLocalePath } from "@/lib/locale-path";
import { getSlideshow, type SlideshowSlideDto } from "@/lib/slideshow-api";
import { formatNumber } from "@/lib/vendora/format";
import { useBrandCopy } from "@/components/vendora/layout/store-settings-provider";
import type { Locale } from "@/lib/vendora/types";

interface HeroSlideshowProps { locale: Locale; }

const defaultSlides: SlideshowSlideDto[] = [
  { id: "default-bags", imageUrl: "/assets/img/vendora/hero-bags.jpg", sortOrder: 0, durationSeconds: 5 },
  { id: "default-camera-bag", imageUrl: "/assets/img/vendora/hero-camera-bag.webp", sortOrder: 1, durationSeconds: 5 },
  { id: "default-rifle-bag", imageUrl: "/assets/img/vendora/hero-rifle-bag.webp", sortOrder: 2, durationSeconds: 5 },
];

/** Retains the homepage content/playlist and single autoplay timer while Swiper owns drag and fade. */
export function HeroSlideshow({ locale }: HeroSlideshowProps) {
  const t = useBrandCopy(locale).home, controls = t.slideshow;
  const [slides, setSlides] = useState<SlideshowSlideDto[]>(defaultSlides);
  const [cursor, setCursor] = useState({ index: 0, revision: 0 });
  const [autoplay, setAutoplay] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [tabHidden, setTabHidden] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [readyImages, setReadyImages] = useState<Set<string>>(() => new Set());
  const [backingSlide, setBackingSlide] = useState(defaultSlides[0]);
  const swiper = useRef<SwiperInstance | null>(null);
  const lastReady = useRef(defaultSlides[0]);
  const selected = useRef(defaultSlides[0]);
  const ready = useRef(new Set<string>());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const activeSlide = slides[cursor.index] ?? slides[0];
  const hasMultiple = slides.length > 1;
  const isRunning = hasMultiple && autoplay && !tabHidden && !hovered && !focused && !interacting && !transitioning && readyImages.has(activeSlide.imageUrl);
  const isEditorial = editorial(activeSlide);
  const positionLabel = controls.position(formatNumber(cursor.index + 1, locale), formatNumber(slides.length, locale));
  const playlistKey = `${locale}:${slides.map(slide => `${slide.id}:${slide.imageUrl}`).join("|")}`;

  useEffect(() => {
    const controller = new AbortController();
    getSlideshow(controller.signal).then(configured => {
      if (controller.signal.aborted) return;
      const playlist = configured.length ? configured : defaultSlides;
      selected.current = playlist[0];
      setSlides(playlist); setCursor({ index: 0, revision: 0 });
      setTransitioning(false); setInteracting(false);
    }).catch(() => { /* Preserve the existing default series on API failure. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motion.matches); setAutoplay(!motion.matches); setTabHidden(document.hidden);
    /** Hidden tabs pause the timer instead of accumulating missed transitions. */
    const visibility = () => setTabHidden(document.hidden);
    /** Reduced motion removes zoom/fade and stops automatic playback until explicitly requested. */
    const preference = (event: MediaQueryListEvent) => { setReducedMotion(event.matches); if (event.matches) setAutoplay(false); };
    document.addEventListener("visibilitychange", visibility); motion.addEventListener("change", preference);
    return () => { document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", preference); };
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setTimeout(() => swiper.current?.slideNext(), activeSlide.durationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [cursor, activeSlide.durationSeconds, isRunning]);

  /** Records decoded images; an opaque previous photo remains underneath until the next is ready. */
  const imageReady = useCallback((slide: SlideshowSlideDto) => {
    if (ready.current.has(slide.imageUrl)) return;
    ready.current.add(slide.imageUrl);
    setReadyImages(new Set(ready.current));
    if (selected.current.imageUrl === slide.imageUrl) lastReady.current = slide;
  }, []);

  /** Lets autoplay pass a failed photo while retaining the last valid image as its visual fallback. */
  const imageUnavailable = useCallback((slide: SlideshowSlideDto) => {
    setReadyImages(current => new Set(current).add(slide.imageUrl));
  }, []);

  /** Synchronizes every input method with one index and restarts zoom on each activation. */
  function slideChanged(instance: SwiperInstance) {
    const next = slides[instance.realIndex];
    if (!next) return;
    setBackingSlide(lastReady.current);
    selected.current = next;
    if (ready.current.has(next.imageUrl)) lastReady.current = next;
    setCursor(current => ({ index: instance.realIndex, revision: current.revision + 1 }));
  }

  /** Keyboard navigation follows reading direction without capturing modified browser shortcuts. */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!hasMultiple || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    if (event.key === (locale === "fa" ? "ArrowLeft" : "ArrowRight")) swiper.current?.slideNext();
    else swiper.current?.slidePrev();
  }

  return <section aria-labelledby="vd-hero-title" aria-roledescription={controls.carousel} tabIndex={hasMultiple ? 0 : undefined}
    className="vd-container vd-hero-slideshow vd-focus relative mt-[24px] md:mt-[28px] lg:mt-[31px]"
    onKeyDown={onKeyDown}
    onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onPointerDownCapture={event => { if (event.button === 0) { pointer.current = { x: event.clientX, y: event.clientY }; dragged.current = false; } }}
    onPointerMoveCapture={event => { if (pointer.current && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 8) dragged.current = true; }}
    onPointerUpCapture={() => { pointer.current = null; }} onPointerCancelCapture={() => { pointer.current = null; setInteracting(false); }}
    onClickCapture={event => { if (dragged.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); dragged.current = false; } }}>
    <div className="relative min-h-[510px] overflow-hidden rounded-hero bg-white md:h-[410px] md:min-h-0 md:bg-surface-soft lg:h-[480px]">
      <div className="vd-hero__photos">
        <div aria-hidden="true" className="vd-hero__backing"><HeroPhoto slide={backingSlide} active={false} eager onReady={imageReady} /></div>
        {hasMultiple ? <Swiper key={playlistKey} dir={locale === "fa" ? "rtl" : "ltr"} modules={[EffectFade, Mousewheel]} effect="fade" fadeEffect={{ crossFade: true }}
          slidesPerView={1} loop={hasMultiple} speed={reducedMotion ? 0 : 600} simulateTouch threshold={8} grabCursor={hasMultiple}
          allowTouchMove={hasMultiple} mousewheel={{ enabled: hasMultiple, forceToAxis: true, thresholdDelta: 20, thresholdTime: 650 }}
          preventClicks preventClicksPropagation onSwiper={instance => { swiper.current = instance; }}
          onSlideChange={slideChanged} onTouchStart={() => setInteracting(true)} onTouchEnd={() => setInteracting(false)}
          onTransitionStart={() => setTransitioning(true)} onTransitionEnd={() => setTransitioning(false)} className="vd-hero__swiper">
          {slides.map((slide, index) => <SwiperSlide key={slide.id} aria-hidden={cursor.index !== index}>
            <HeroPhoto slide={slide} active={cursor.index === index} eager={index === cursor.index || index === (cursor.index + 1) % slides.length || index === (cursor.index - 1 + slides.length) % slides.length} onReady={imageReady} onUnavailable={imageUnavailable} />
          </SwiperSlide>)}
        </Swiper> : <div className="vd-hero__static"><HeroPhoto key={activeSlide.imageUrl} slide={activeSlide} active eager onReady={imageReady} onUnavailable={imageUnavailable} /></div>}
        {hasMultiple && <div className="vd-hero__arrows">
          <button type="button" className="vd-focus vd-hero__arrow vd-hero__previous" aria-label={controls.previous} onClick={() => swiper.current?.slidePrev()}><ChevronIcon size={24} className="rotate-180" /></button>
          <button type="button" className="vd-focus vd-hero__arrow vd-hero__next" aria-label={controls.next} onClick={() => swiper.current?.slideNext()}><ChevronIcon size={24} /></button>
        </div>}
      </div>
      <div className={`vd-hero__shade pointer-events-none absolute start-0 top-0 z-[2] hidden h-full bg-gradient-to-r from-white/95 via-white/80 to-transparent rtl:bg-gradient-to-l md:block ${isEditorial ? "w-[55%]" : "w-full"}`} />
      <div className="pointer-events-none relative z-[3] flex flex-col px-[26px] pb-[26px] pt-[270px] md:h-full md:justify-center md:px-[44px] md:py-[28px] lg:px-14 lg:py-10">
        <span className="inline-flex w-fit items-center rounded-full bg-jade-tint px-3 py-1 text-xs font-semibold text-jade">{t.heroBadge}</span>
        <h1 id="vd-hero-title" className="mt-[12px] max-w-xl whitespace-pre-line text-[28px] font-bold leading-[43px] text-ink lg:mt-4 lg:text-[48px] lg:leading-[1.4]">{t.heroTitle}</h1>
        <p className="mt-[6px] max-w-lg text-[14px] leading-[26px] text-vd-muted lg:mt-4 lg:text-[1.0625rem] lg:leading-8">{t.heroBody}</p>
        <div className="mt-[6px] flex flex-wrap gap-4 lg:mt-7">
          <VendoraButton href={withLocalePath("/shop", locale)} size="lg" className="pointer-events-auto">{t.heroPrimary}</VendoraButton>
          <VendoraButton href={withLocalePath("/about", locale)} variant="outline" size="lg" className="pointer-events-auto hidden! lg:inline-flex!">{t.heroSecondary}</VendoraButton>
        </div>
      </div>
      {hasMultiple && <button type="button" className="vd-focus vd-hero__autoplay" aria-label={autoplay ? controls.pause : controls.play} onClick={() => setAutoplay(current => !current)}>{autoplay ? <PauseIcon size={20} /> : <PlayIcon size={20} />}</button>}
    </div>
    <span className="vd-sr-only" aria-live={isRunning ? "off" : "polite"} aria-atomic="true">{positionLabel}</span>
  </section>;
}

/** Keeps the approved half-width treatment for the existing two built-in editorial photos. */
function editorial(slide: SlideshowSlideDto) { return slide.id === "default-camera-bag" || slide.id === "default-rifle-bag"; }

interface HeroPhotoProps { slide: SlideshowSlideDto; active: boolean; eager: boolean; onReady: (slide: SlideshowSlideDto) => void; onUnavailable?: (slide: SlideshowSlideDto) => void; }

/** Decodes before fading/zooming, replaying the same entrance whenever this photo becomes active. */
function HeroPhoto({ slide, active, eager, onReady, onUnavailable }: HeroPhotoProps) {
  const [loaded, setLoaded] = useState(false);
  return <div className={`vd-hero__photo ${active && loaded ? "is-active" : ""}`} data-ready={loaded} data-editorial={editorial(slide)}>
    <Image src={slide.imageUrl} alt="" fill draggable={false} unoptimized={slide.imageUrl.includes("/uploads/")} loading={eager ? "eager" : "lazy"}
      sizes={editorial(slide) ? "(max-width: 767px) 100vw, 656px" : "(max-width: 767px) 100vw, 1312px"}
      onLoad={async event => { const image = event.currentTarget; try { await image.decode(); } catch { /* Load still confirms a displayable image. */ } setLoaded(true); onReady(slide); }}
      onError={() => onUnavailable?.(slide)}
      className="object-cover object-center" />
  </div>;
}

"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";
import { PinIcon } from "@/components/vendora/icons";
import { VendoraButton } from "@/components/vendora/ui/button";
import type { MapCoordinates } from "@/lib/account-addresses";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";

const sdkRoot = "https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8";
type LatLng = { lat: number; lng: number };

interface NeshanMap {
  on(event: "click", handler: (event: { latlng: LatLng }) => void): void;
  getCenter(): LatLng;
  setView(center: [number, number], zoom: number): void;
  invalidateSize(): void;
  remove(): void;
}

interface NeshanMarker {
  addTo(map: NeshanMap): NeshanMarker;
  setLatLng(point: [number, number]): void;
  getLatLng(): LatLng;
  on(event: "dragend", handler: () => void): void;
  remove(): void;
}

interface NeshanSdk {
  Map: new (element: HTMLElement, options: { key: string; maptype: string; center: [number, number]; zoom: number; scrollWheelZoom: boolean }) => NeshanMap;
  marker(point: [number, number], options: { draggable: boolean; title: string; alt: string; icon: object }): NeshanMarker;
  divIcon(options: { className: string; html: string; iconSize: [number, number]; iconAnchor: [number, number] }): object;
}

interface NeshanLocationPickerProps {
  locale: Locale;
  apiKey: string;
  value: MapCoordinates | null;
  onChange: (value: MapCoordinates | null) => void;
}

/** Expands the official Neshan map on demand; selected points remain part of the parent address form. */
export function NeshanLocationPicker({ locale, apiKey, value, onChange }: NeshanLocationPickerProps) {
  const t = getDict(locale).account.addresses;
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mt-6 overflow-hidden rounded-card border border-vd-line bg-surface-soft" aria-label={t.form.mapTitle}>
      <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((open) => !open)} className="vd-focus flex w-full items-center gap-[16px] rounded-card p-[20px] text-start text-ink md:p-6">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-white text-jade"><PinIcon size={26} /></span>
        <span className="min-w-0 flex-1"><span className="block text-base font-bold">{t.form.mapTitle}</span><span className="vd-text-caption mt-1 block text-vd-muted">{t.form.mapBody}</span></span>
        <span className="hidden shrink-0 text-sm font-bold text-jade sm:block">{expanded ? t.map.collapse : t.form.mapCta}</span>
      </button>
      <div id={panelId} hidden={!expanded}>
        {expanded ? (apiKey ? <NeshanMapCanvas locale={locale} apiKey={apiKey} value={value} onChange={onChange} /> : <p role="alert" className="px-5 pb-5 text-sm leading-7 text-vd-muted">{t.map.unavailable}</p>) : null}
      </div>
      {value ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-vd-line px-[20px] py-4">
        <p className="vd-text-caption text-jade"><span className="block font-bold">{t.locationSaved}</span><span dir="ltr" aria-label={t.map.coordinates}>{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</span></p>
        <VendoraButton type="button" variant="ghost" onClick={() => onChange(null)}>{t.map.clear}</VendoraButton>
      </div> : null}
    </section>
  );
}

/** Owns the SDK map/marker lifecycle, map clicks, marker dragging and opt-in browser geolocation. */
function NeshanMapCanvas({ locale, apiKey, value, onChange }: NeshanLocationPickerProps) {
  const t = getDict(locale).account.addresses.map;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<NeshanMap | null>(null);
  const marker = useRef<NeshanMarker | null>(null);
  const initialValue = useRef(value);
  const alive = useRef(false);
  const locatingRef = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<NeshanMap | null>(null);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const mapReady = mapInstance !== null;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!sdkReady || !container.current) return;
    const sdk = (window as Window & { L?: NeshanSdk }).L;
    if (!sdk) { setError(t.failed); return; }
    try {
      const point = initialValue.current;
      const instance = new sdk.Map(container.current, {
        key: apiKey,
        maptype: "dreamy",
        center: point ? [point.latitude, point.longitude] : [35.699756, 51.338076],
        zoom: point ? 16 : 12,
        scrollWheelZoom: false,
      });
      map.current = instance;
      /** Saves an intentional selection and normalizes longitudes from repeated world tiles. */
      function select(point: LatLng) {
        onChange({ latitude: point.lat, longitude: ((point.lng + 180) % 360 + 360) % 360 - 180 });
      }
      instance.on("click", (event) => select(event.latlng));
      const observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
      setMapInstance(instance);
      return () => {
        observer.disconnect();
        instance.remove();
        map.current = null;
        marker.current = null;
        setMapInstance(null);
      };
    } catch {
      setError(t.failed);
    }
  }, [apiKey, onChange, sdkReady, t.failed]);

  useEffect(() => {
    const instance = mapInstance;
    const sdk = (window as Window & { L?: NeshanSdk }).L;
    if (!instance || !sdk) return;
    if (!value) { marker.current?.remove(); marker.current = null; return; }
    const point: [number, number] = [value.latitude, value.longitude];
    if (marker.current) { marker.current.setLatLng(point); return; }
    const pin = sdk.marker(point, {
      draggable: true,
      title: t.marker,
      alt: t.marker,
      icon: sdk.divIcon({
        className: "vd-map-marker",
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44" aria-hidden="true"><path d="M18 42S2 26 2 18a16 16 0 0 1 32 0c0 8-16 24-16 24Z" fill="currentColor" stroke="white" stroke-width="2"/><circle cx="18" cy="18" r="5" fill="white"/></svg>',
        iconSize: [36, 44],
        iconAnchor: [18, 42],
      }),
    }).addTo(instance);
    pin.on("dragend", () => {
      const point = pin.getLatLng();
      onChange({ latitude: point.lat, longitude: ((point.lng + 180) % 360 + 360) % 360 - 180 });
    });
    marker.current = pin;
  }, [mapInstance, onChange, t.marker, value]);

  /** Requests location only after a user gesture; stale callbacks cannot update a closed map. */
  function locate() {
    if (!navigator.geolocation) { setError(t.locationFailed); return; }
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      locatingRef.current = false;
      if (!alive.current) return;
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      map.current?.setView([point.latitude, point.longitude], 16);
      onChange(point);
      setLocating(false);
    }, (failure) => {
      locatingRef.current = false;
      if (!alive.current) return;
      setLocating(false);
      setError(failure.code === 1 ? t.locationDenied : t.locationFailed);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  /** Enables keyboard users to choose the center after panning with the SDK's arrow-key controls. */
  function selectCenter() {
    const point = map.current?.getCenter();
    if (point) onChange({ latitude: point.lat, longitude: ((point.lng + 180) % 360 + 360) % 360 - 180 });
  }

  return (
    <div className="border-t border-vd-line p-[16px] md:p-[20px]">
      <link rel="stylesheet" href={`${sdkRoot}/index.css`} />
      <Script src={`${sdkRoot}/index.js`} strategy="afterInteractive" onReady={() => setSdkReady(true)} onError={() => setError(t.failed)} />
      <p className="vd-text-caption mb-3 text-vd-muted">{t.instructions}</p>
      <div className="relative isolate overflow-hidden rounded-control border border-vd-line bg-tile-steel">
        <div ref={container} className="vd-neshan-map h-[320px] w-full text-jade md:h-[400px]" dir="ltr" aria-label={t.marker} />
        {!mapReady && !error ? <p role="status" className="absolute inset-0 flex items-center justify-center bg-surface-soft text-sm text-vd-muted">{t.loading}</p> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <VendoraButton type="button" variant="outline" disabled={!mapReady || locating} onClick={locate}>{locating ? t.locating : t.locate}</VendoraButton>
        <VendoraButton type="button" variant="outline" disabled={!mapReady} onClick={selectCenter}>{t.selectCenter}</VendoraButton>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm leading-7 text-vd-danger">{error}</p> : null}
    </div>
  );
}

"use client";

import { createPopper } from "@popperjs/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export type HeaderDropdownId = "account" | "wishlist" | "cart";
const focusable = 'a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]';

/** Coordinates the existing header triggers, non-modal desktop popovers and mobile overlays. */
export function useHeaderDropdowns(pathname: string) {
  const [active, setActive] = useState<HeaderDropdownId | null>(null);
  const [desktop, setDesktop] = useState(false);
  const triggers = useRef<Partial<Record<HeaderDropdownId, HTMLElement | null>>>({});
  const panels = useRef<Partial<Record<HeaderDropdownId, HTMLElement | null>>>({});
  const anchor = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreFocus = useRef<HTMLElement | null>(null);
  const focusFirst = useRef(false);

  /** Registers existing trigger elements without exposing mutable hook internals. */
  const registerTrigger = useCallback((id: HeaderDropdownId, element: HTMLElement | null) => { triggers.current[id] = element; }, []);
  /** Registers the surface belonging to the current responsive header layout. */
  const registerPanel = useCallback((id: HeaderDropdownId, element: HTMLElement | null, mode?: "desktop" | "mobile") => {
    if (!mode || (mode === "desktop") === desktop) panels.current[id] = element;
  }, [desktop]);

  /** Cancels the short pointer bridge between the trigger and its floating surface. */
  const cancelClose = useCallback(() => { if (timer.current) clearTimeout(timer.current); }, []);
  /** Closes the current surface, optionally returning keyboard focus without reopening it. */
  const close = useCallback((restoreFocus = false) => {
    cancelClose();
    setActive(null);
    if (restoreFocus && anchor.current?.isConnected && document.activeElement !== anchor.current) {
      ignoreFocus.current = anchor.current;
      anchor.current.focus({ preventScroll: true });
    }
  }, [cancelClose]);
  /** Opens one surface, with the visible initiating element as the positioning/focus anchor. */
  const open = useCallback((id: HeaderDropdownId, element?: HTMLElement) => {
    cancelClose();
    anchor.current = element ?? triggers.current[id] ?? null;
    setActive(id);
  }, [cancelClose]);
  /** Preserves click-to-toggle even when a keyboard focus event opened the surface first. */
  const toggle = useCallback((id: HeaderDropdownId, element: HTMLElement) => {
    if (active === id) close(); else open(id, element);
  }, [active, close, open]);
  /** Pointer-only delayed dismissal; focused content remains available to keyboard users. */
  const leave = useCallback((event?: ReactPointerEvent<HTMLElement>) => {
    if (event && event.pointerType !== "mouse") return;
    cancelClose();
    timer.current = setTimeout(() => {
      if (!active || !panels.current[active]?.contains(document.activeElement)) setActive(null);
    }, 220);
  }, [active, cancelClose]);
  /** Ignores emulated touch hover so mobile retains explicit tap behavior. */
  const enter = useCallback((id: HeaderDropdownId, event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && window.matchMedia("(min-width: 1280px)").matches) open(id);
  }, [open]);
  /** Opens from keyboard focus, without opening on the pointer's pre-click focus event. */
  const focus = useCallback((id: HeaderDropdownId, event: FocusEvent<HTMLElement>) => {
    if (ignoreFocus.current === event.target) { ignoreFocus.current = null; return; }
    if (event.target === event.currentTarget && event.target.matches(":focus-visible")) open(id, event.currentTarget);
  }, [open]);
  /** Dismisses only after focus has left both the trigger and the controlled surface. */
  const blur = useCallback((id: HeaderDropdownId, event: FocusEvent<HTMLElement>) => {
    if (active !== id) return;
    const next = event.relatedTarget;
    if (next instanceof Node && (triggers.current[id]?.contains(next) || panels.current[id]?.contains(next))) return;
    if (next) close();
  }, [active, close]);
  /** Arrow-down enters the first action; native Tab navigation remains intact. */
  const keyDown = useCallback((id: HeaderDropdownId, event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    focusFirst.current = true;
    open(id, event.currentTarget);
    if (active === id) { panels.current[id]?.querySelector<HTMLElement>(focusable)?.focus(); focusFirst.current = false; }
  }, [active, open]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    setDesktop(media.matches);
    /** Closes old overlays before changing between the existing header layouts. */
    const resize = () => { close(); setDesktop(media.matches); };
    media.addEventListener("change", resize);
    return () => { media.removeEventListener("change", resize); cancelClose(); };
  }, [cancelClose, close]);
  useEffect(() => { close(); }, [pathname, close]);
  useEffect(() => {
    if (!active) return;
    const panel = panels.current[active];
    const trigger = anchor.current;
    /** Escape is shared by all three surfaces; an outside pointer may activate its own target. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(true); return; }
      if (event.key === "Tab" && !desktop && panel) {
        const actions = Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(node => node.getClientRects().length > 0);
        const next = event.shiftKey && document.activeElement === actions[0] ? actions.at(-1)
          : !event.shiftKey && document.activeElement === actions.at(-1) ? actions[0] : undefined;
        if (next) { event.preventDefault(); next.focus(); }
      }
    };
    const outside = (event: PointerEvent) => {
      // Mobile already has real backdrop click handlers. Let their click finish
      // before restoring focus, rather than racing native touch focus on pointerdown.
      if (!desktop) return;
      if (event.target instanceof Node && !panel?.contains(event.target) && !trigger?.contains(event.target)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", outside);
    if (focusFirst.current) { panel?.querySelector<HTMLElement>(focusable)?.focus(); focusFirst.current = false; }
    let positioner: ReturnType<typeof createPopper> | undefined;
    /** Keeps tall menus below their trigger when only the viewport height changes. */
    const fitHeight = () => { if (desktop && panel && trigger) panel.style.maxHeight = `${Math.max(0, window.innerHeight - trigger.getBoundingClientRect().bottom - 28)}px`; };
    /** Dismisses a desktop popover when page scrolling removes its header anchor from view. */
    const anchorScrolledAway = () => {
      if (!desktop || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) close();
    };
    let observer: ResizeObserver | undefined;
    if (desktop && panel && trigger) {
      fitHeight();
      positioner = createPopper(trigger, panel, {
        strategy: "fixed", placement: "bottom-start",
        modifiers: [{ name: "offset", options: { offset: [0, 12] } }, { name: "flip", enabled: false },
          { name: "preventOverflow", options: { padding: 16, altAxis: false } }],
      });
      observer = new ResizeObserver(() => { void positioner?.update(); });
      observer.observe(panel);
      window.addEventListener("resize", fitHeight);
      window.addEventListener("scroll", anchorScrolledAway);
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", outside);
      positioner?.destroy();
      observer?.disconnect();
      window.removeEventListener("resize", fitHeight);
      window.removeEventListener("scroll", anchorScrolledAway);
    };
  }, [active, close, desktop]);
  return { active, desktop, registerTrigger, registerPanel, open, close, toggle, enter, leave, focus, blur, keyDown, cancelClose };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const NAV_START = "nav-progress:start";

/** Call before router.push so the bar shows for navigations that don't come from a link tap. */
export function startNavProgress() {
  window.dispatchEvent(new Event(NAV_START));
}

/**
 * Thin bar at the top of the screen from the moment a link is tapped until the new page is shown,
 * so switching tabs, dates or pages never feels ignored (Zaky, 16 Nov 2026).
 */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const safety = useRef<number | undefined>(undefined);

  useEffect(() => {
    function start() {
      setState("loading");
      clearTimeout(safety.current);
      // Never leave the bar stuck if a navigation is cancelled.
      safety.current = window.setTimeout(() => setState("idle"), 15000);
    }
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // File downloads (CSV) and API routes don't change the page.
      if (/\/(csv|api)(\/|$)/.test(url.pathname)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAV_START, start);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAV_START, start);
      window.removeEventListener("popstate", start);
      clearTimeout(safety.current);
    };
  }, []);

  // The URL only changes once the new page is on screen.
  useEffect(() => {
    clearTimeout(safety.current);
    setState((s) => (s === "loading" ? "done" : s));
    const t = window.setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 500);
    return () => clearTimeout(t);
  }, [path, search]);

  return <div className={`navbar ${state}`} role="progressbar" aria-hidden={state !== "loading"} aria-label="Memuat halaman" />;
}

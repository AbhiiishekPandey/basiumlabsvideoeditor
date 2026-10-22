"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { useMediaQuery } from "@/lib/use-media-query";

type Tag = { label: string; poster?: string } | null;

// Desktop only: a small tag trails the system cursor over playable elements
// ([data-cursor]); index rows add a poster thumbnail. The real cursor is
// never hidden.
export function CursorTag() {
  const enabled = useMediaQuery("(hover: hover) and (pointer: fine)");
  const ref = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState<Tag>(null);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const xTo = gsap.quickTo(el, "x", { duration: reduce ? 0 : 0.35, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: reduce ? 0 : 0.35, ease: "power3" });
    let current: Element | null = null;

    const onMove = (e: PointerEvent) => {
      xTo(e.clientX + 18);
      yTo(e.clientY + 18);
      const target = (e.target as Element).closest?.("[data-cursor]") ?? null;
      if (target === current) return;
      current = target;
      setTag(
        target instanceof HTMLElement
          ? { label: target.dataset.cursor || "Play", poster: target.dataset.cursorPoster }
          : null,
      );
    };
    const onLeave = () => {
      current = null;
      setTag(null);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none fixed top-0 left-0 z-[70] transition-opacity duration-150 ${tag ? "opacity-100" : "opacity-0"}`}
    >
      {tag?.poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tag.poster} alt="" className="mb-1 h-28 w-auto max-w-56 object-cover" />
      )}
      <span className="inline-flex items-center gap-1.5 bg-rec px-2 py-1 font-mono text-[10px] tracking-[0.15em] text-bone uppercase">
        ▶ {tag?.label}
      </span>
    </div>
  );
}

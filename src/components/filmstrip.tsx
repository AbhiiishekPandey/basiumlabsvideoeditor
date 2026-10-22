"use client";

import { useEffect, useRef, useState } from "react";
import { totalRuntime, type Project } from "@/content/projects";
import { toTimecode } from "@/lib/timecode";
import { Caption } from "./caption";
import { ProjectFrame } from "./project-frame";

type Props = {
  projects: Project[];
  onPlay: (index: number) => void;
  clip: (index: number) => string;
  label: string;
};

// Native horizontal scroller (touch, trackpad, keyboard focus all work) with
// equal-height frames, so vertical and widescreen pieces sit on one strip.
export function Filmstrip({ projects, onPlay, clip, label }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const trt = totalRuntime(projects);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const p = max > 0 ? el.scrollLeft / max : 0;
      if (progressRef.current) progressRef.current.style.left = `${p * 100}%`;
      if (timecodeRef.current) timecodeRef.current.textContent = toTimecode(p * trt);
      setEdges((prev) => {
        const next = { start: el.scrollLeft < 4, end: el.scrollLeft > max - 4 };
        return prev.start === next.start && prev.end === next.end ? prev : next;
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [trt]);

  const page = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div>
      <div
        ref={scrollerRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] focus-visible:outline-offset-[-2px] sm:scroll-px-8 sm:gap-6 sm:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {projects.map((p, i) => (
          <article key={p.slug} aria-label={p.title} className="shrink-0 snap-start" style={{ width: `calc(var(--strip-h) * ${p.width / p.height})` }}>
            <div data-clip-in>
              <ProjectFrame project={p} onPlay={() => onPlay(i)} clip={clip(i)} className="w-full" />
            </div>
            <Caption project={p} n={clip(i)} />
          </article>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4 px-4 sm:gap-6 sm:px-8">
        <div className="flex gap-2">
          <button type="button" onClick={() => page(-1)} disabled={edges.start} className="btn-ghost" aria-label="Scroll filmstrip back">
            ←
          </button>
          <button type="button" onClick={() => page(1)} disabled={edges.end} className="btn-ghost" aria-label="Scroll filmstrip forward">
            →
          </button>
        </div>
        {/* Scrub track: one tick per film, playhead tracks horizontal scroll. */}
        <div aria-hidden="true" className="relative h-6 flex-1 border-y border-line">
          <div className="absolute inset-0 flex">
            {projects.map((p) => (
              <div key={p.slug} className="h-full border-l border-line" style={{ flex: `${p.durationSeconds} 1 0%` }} />
            ))}
          </div>
          <div ref={progressRef} className="absolute -inset-y-1 w-px bg-rec" />
        </div>
        <span ref={timecodeRef} aria-hidden="true" className="hidden font-mono text-[11px] tracking-[0.12em] text-bone-dim tabular-nums sm:block">
          00:00:00:00
        </span>
      </div>
    </div>
  );
}

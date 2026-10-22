"use client";

import { useEffect, useRef } from "react";
import {
  aspectLabel,
  isVertical,
  totalRuntime,
  type Category,
  type Project,
} from "@/content/projects";
import { gsap } from "@/lib/gsap";
import { toRuntime, toTimecode } from "@/lib/timecode";
import { Caption } from "./caption";
import { Filmstrip } from "./filmstrip";
import { usePlayer } from "./player";
import { ProjectFrame } from "./project-frame";

type Props = { category: Category; projects: Project[] };

export function Chapter({ category, projects }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const { openPlayer } = usePlayer();
  const titleId = `${category.id}-title`;
  const play = (i: number) => openPlayer(projects, i);
  const clip = (i: number) => `${category.index}·${String(i + 1).padStart(2, "0")}`;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: "top 78%", once: true },
      });
      // The chapter rule draws like a cut line, then the title words rise.
      tl.from("[data-cut-line]", { scaleX: 0, transformOrigin: "left", duration: 0.7, ease: "expo.inOut" })
        .from("[data-word]", { yPercent: 110, duration: 0.9, stagger: 0.07, ease: "power4.out" }, "-=0.35")
        .from("[data-slate]", { autoAlpha: 0, duration: 0.01, stagger: 0.1 }, "-=0.6");
      // Frames wipe in as they arrive, like clips dropped on a timeline.
      gsap.utils.toArray<HTMLElement>("[data-clip-in]", root).forEach((el) => {
        gsap.fromTo(
          el,
          { clipPath: "inset(0% 0% 100% 0%)" },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1,
            ease: "expo.inOut",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        );
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      id={category.id}
      aria-labelledby={titleId}
      data-chapter={category.index}
      className="relative scroll-mt-16 pt-10 pb-16 sm:pt-14 sm:pb-24"
    >
      <div data-cut-line aria-hidden="true" className="mx-4 h-px bg-line sm:mx-8" />

      <header className="mt-6 grid gap-y-5 px-4 sm:mt-8 sm:px-8 md:grid-cols-12 md:items-end md:gap-x-8">
        <div className="md:col-span-8">
          <p data-slate className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tracking-[0.18em] text-bone-dim uppercase sm:text-xs">
            <span className="text-rec">Ch {category.index}</span>
            <span>{projects.length} {projects.length === 1 ? "film" : "films"}</span>
            <span>TRT {toTimecode(totalRuntime(projects))}</span>
          </p>
          <h2 id={titleId} className="font-display text-[clamp(3.25rem,11vw,10.5rem)] leading-[0.86] uppercase">
            {category.title.split(" ").map((word) => (
              <span key={word} className="mr-[0.18em] inline-block overflow-hidden pb-[0.04em] align-bottom last:mr-0">
                <span data-word className="inline-block">{word}</span>
              </span>
            ))}
          </h2>
        </div>
        <p data-slate className="max-w-sm text-base text-pretty text-bone-dim sm:text-lg md:col-span-4 md:justify-self-end">
          {category.summary}
        </p>
      </header>

      <div className="mt-12 sm:mt-16">
        {category.id === "short-form" ? (
          <Filmstrip projects={projects} onPlay={play} clip={clip} label={`${category.title} films`} />
        ) : category.id === "long-form" ? (
          <Spreads projects={projects} onPlay={play} clip={clip} />
        ) : (
          <JustifiedRows projects={projects} onPlay={play} clip={clip} />
        )}
      </div>
    </section>
  );
}

type LayoutProps = {
  projects: Project[];
  onPlay: (index: number) => void;
  clip: (index: number) => string;
};

// Mixed aspect ratios share a row at one height: each item's flex-grow is its
// aspect ratio, so widths fall out of the footage instead of a fixed grid.
// Horizontal and vertical pieces pair up, alternating sides row by row.
function JustifiedRows({ projects, onPlay, clip }: LayoutProps) {
  const indexed = projects.map((p, i) => ({ p, i }));
  const wide = indexed.filter(({ p }) => !isVertical(p));
  const tall = indexed.filter(({ p }) => isVertical(p));
  const rows: (typeof indexed)[] = [];
  for (let r = 0; r < Math.max(wide.length, tall.length); r++) {
    const row = [wide[r], tall[r]].filter(Boolean);
    rows.push(r % 2 ? row.reverse() : row);
  }

  return (
    <div className="flex flex-col gap-14 px-4 sm:px-8 md:gap-20">
      {rows.map((row, r) => (
        <div key={r} className="flex flex-col gap-10 md:flex-row md:gap-6">
          {row.map(({ p, i }) => (
            <article
              key={p.slug}
              aria-label={p.title}
              className={`md:[flex:var(--grow)_1_0%] ${isVertical(p) ? "w-4/5 self-center md:w-auto md:self-auto" : ""}`}
              style={{ "--grow": p.width / p.height } as React.CSSProperties}
            >
              <div data-clip-in>
                <ProjectFrame project={p} onPlay={() => onPlay(i)} clip={clip(i)} className="w-full" />
              </div>
              <Caption project={p} n={clip(i)} />
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}

// Editorial spreads: frame and spec sheet, alternating sides.
function Spreads({ projects, onPlay, clip }: LayoutProps) {
  return (
    <div className="flex flex-col gap-20 px-4 sm:px-8 md:gap-28">
      {projects.map((p, i) => {
        const flip = i % 2 === 1;
        return (
          <article key={p.slug} aria-label={p.title} className="grid items-end gap-8 md:grid-cols-12 md:gap-8">
            <div data-clip-in className={`md:col-span-8 ${flip ? "md:order-2" : ""}`}>
              <ProjectFrame project={p} onPlay={() => onPlay(i)} clip={clip(i)} className="w-full" />
            </div>
            <div className={`flex flex-col gap-6 md:col-span-4 ${flip ? "md:order-1" : ""}`}>
              <p className="font-mono text-xs text-rec">{clip(i)}</p>
              <h3 className="font-display text-5xl leading-[0.9] uppercase lg:text-7xl">{p.title}</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 font-mono text-[11px] tracking-[0.12em] uppercase">
                <Spec term="Format" value={p.format} />
                <Spec term="Runtime" value={toRuntime(p.durationSeconds)} />
                <Spec term="Aspect" value={aspectLabel(p)} />
                <Spec term="Frame rate" value={`${p.fps} fps`} />
              </dl>
              <Ruler project={p} />
              <button type="button" onClick={() => onPlay(i)} className="btn-solid self-start">
                ▶ Play film · {toRuntime(p.durationSeconds)}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Spec({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-bone-dim">{term}</dt>
      <dd className="mt-1 text-bone">{value}</dd>
    </div>
  );
}

/** Edit-bay ruler: full runtime with the preview range highlighted. */
function Ruler({ project }: { project: Project }) {
  const pct = (s: number) => `${(s / project.durationSeconds) * 100}%`;
  return (
    <div aria-hidden="true" className="font-mono text-[10px] tracking-[0.1em] text-bone-dim tabular-nums">
      <div className="relative h-6 border-y border-line">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,var(--line)_0_1px,transparent_1px_10%)]" />
        <div
          className="absolute inset-y-0 bg-rec/25"
          style={{ left: pct(project.previewStart), width: pct(project.previewSeconds) }}
        />
      </div>
      <div className="mt-1.5 flex justify-between">
        <span>{toTimecode(0, project.fps)}</span>
        <span>{toTimecode(project.durationSeconds, project.fps)}</span>
      </div>
    </div>
  );
}

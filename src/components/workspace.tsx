"use client";

import { useState, type CSSProperties } from "react";
import {
  categories,
  heroProject,
  isVertical,
  projects,
  projectsIn,
  type CategoryId,
} from "@/content/projects";
import { profile } from "@/content/profile";
import { toRuntime, toSpokenRuntime } from "@/lib/timecode";
import { Hero } from "./hero";
import { FilmIcon, MailIcon, PlayIcon, ReelIcon } from "./icons";
import { usePlayer } from "./player";
import { WorkCard } from "./work-card";

type Filter = CategoryId | "all";
const reels = projects.filter(isVertical);

// Collapsed, the grid shows exactly its full rows: 2×2 on phones, 3×2 on
// tablets, one row of 4 on laptops and 5 on wide screens.
const COLLAPSED = 6;
const collapsedVisibility = (i: number) =>
  i < 4 ? "" : i === 4 ? "hidden md:block lg:hidden 2xl:block" : "hidden md:block lg:hidden";
// Side column scales with the window instead of staying a fixed 250px.
const SIDE_W = "clamp(230px,18vw,340px)";

// The main glass window: top bar, hero carousel, side panels and the work grid.
export function Workspace() {
  const { openPlayer } = usePlayer();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);

  const list = filter === "all" ? projects : projectsIn(filter);
  const shown = expanded ? list : list.slice(0, COLLAPSED);
  const filterLabel = filter === "all" ? "All work" : categories.find((c) => c.id === filter)?.title;

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All work" },
    ...categories.map((c) => ({ id: c.id, label: c.title })),
  ];

  return (
    <div
      className="glass rounded-[28px] p-2.5 sm:rounded-[40px] sm:p-5 2xl:p-6"
      style={{ "--side-w": SIDE_W } as CSSProperties}
    >
      <header className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
        <a
          href="#top"
          className="glass-panel flex min-w-0 items-center gap-3 rounded-full py-2 pr-5 pl-4 lg:w-[var(--side-w)] lg:shrink-0"
        >
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-live" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">{profile.name}</span>
            <span className="block truncate text-xs text-fg-dim">{profile.role}</span>
          </span>
        </a>

        <a href="#contact" className="pill-solid pill-sm ml-auto lg:order-last">
          <MailIcon size={15} /> Contact
        </a>

        <nav
          aria-label="Filter work"
          className="flex w-full flex-wrap gap-1 lg:w-auto lg:flex-1 lg:flex-nowrap"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={filter === t.id}
              aria-controls="work"
              onClick={() => {
                setFilter(t.id);
                setExpanded(false);
              }}
              className="pill"
            >
              {t.label}
            </button>
          ))}
          <a href="#about" className="pill">
            About
          </a>
        </nav>
      </header>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-[var(--side-w)_minmax(0,1fr)] lg:grid-rows-[auto_auto] 2xl:gap-5">
        <div className="order-1 min-w-0 lg:col-start-2 lg:row-start-1">
          <Hero intro={heroProject} />
        </div>

        {/* Side panels fill the row height on desktop instead of setting it. */}
        <section
          id="reels"
          aria-labelledby="reels-title"
          className="glass-panel relative order-3 rounded-[24px] lg:col-start-1 lg:row-start-1 lg:min-h-0"
        >
          <div className="flex h-full flex-col p-3.5 lg:absolute lg:inset-0">
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 id="reels-title" className="flex items-center gap-2 text-sm font-semibold">
                <ReelIcon size={16} className="text-hot" /> Reels
              </h2>
              <p className="text-xs text-fg-faint">{reels.length} vertical edits</p>
            </div>
            <ul className="no-scrollbar grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto">
              {reels.map((p, i) => (
                <li key={p.slug} className="lg:shrink-0">
                  <WorkCard
                    project={p}
                    variant="tile"
                    onPlay={() => openPlayer(reels, i, { label: "Reels" })}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="index"
          aria-labelledby="index-title"
          className="glass-panel relative order-4 rounded-[24px] lg:col-start-1 lg:row-start-2 lg:min-h-0"
        >
          <div className="flex h-full flex-col p-3.5 lg:absolute lg:inset-0">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 id="index-title" className="flex items-center gap-2 text-sm font-semibold">
                <FilmIcon size={16} className="text-fg-dim" /> All edits
              </h2>
              <p className="text-xs text-fg-faint">{projects.length} films</p>
            </div>
            <ol className="no-scrollbar md:grid md:grid-cols-2 md:gap-x-3 lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {projects.map((p, i) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    onClick={() => openPlayer(projects, i, { label: "All edits" })}
                    aria-label={`Play ${p.title}, ${p.format}, ${toSpokenRuntime(p.durationSeconds)}`}
                    className="group flex w-full items-center gap-3 rounded-2xl p-1.5 text-left transition-colors hover:bg-white/8"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- poster is a pre-sized static encode */}
                    <img
                      src={p.poster}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-11 shrink-0 rounded-xl bg-scrim object-cover"
                    />
                    <span className="min-w-0 flex-1" aria-hidden="true">
                      <span className="block truncate text-[13px] font-medium">{p.title}</span>
                      <span className="block truncate text-[11px] text-fg-faint">
                        {p.format} · {toRuntime(p.durationSeconds)}
                      </span>
                    </span>
                    <span aria-hidden="true" className="play-disc play-disc-sm bg-white/25 text-fg group-hover:bg-white group-hover:text-[#18181b]">
                      <PlayIcon size={10} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="work"
          aria-labelledby="work-title"
          className="order-2 scroll-mt-6 lg:col-start-2 lg:row-start-2"
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <h2 id="work-title" className="text-lg font-semibold tracking-[-0.01em] sm:text-xl">
              Selected work
              <span className="ml-2 text-sm font-normal text-fg-faint">
                {filterLabel} · {list.length}
              </span>
            </h2>
            {list.length > 4 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                aria-controls="work-grid"
                className="pill pill-sm bg-white/12 text-fg hover:bg-white/20"
              >
                {expanded ? "Show less" : "See all"}
              </button>
            )}
          </div>
          <ul
            id="work-grid"
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
          >
            {shown.map((p, i) => (
              <li key={p.slug} className={expanded ? "" : collapsedVisibility(i)}>
                <WorkCard
                  project={p}
                  onPlay={() => openPlayer(list, i, { label: filterLabel })}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {list.length} {filterLabel} edits
      </p>
    </div>
  );
}

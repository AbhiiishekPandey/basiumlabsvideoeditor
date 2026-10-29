"use client";

import { useEffect, useRef, useState } from "react";
import { aspectLabel, categoryTitle, featured, showreel, type Project } from "@/content/projects";
import { profile } from "@/content/profile";
import { toRuntime } from "@/lib/timecode";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ChevronLeft, ChevronRight, MailIcon, PauseIcon, PlayIcon, SparkIcon } from "./icons";
import { usePlayer } from "./player";

// MVP opens on near-black frames; its intro loop starts where the screen lights up.
const INTRO_LOOP_START = 6;

type Slide = { kind: "intro"; project: Project } | { kind: "featured"; project: Project; index: number };

function prefersSavingData() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

export function Hero({ intro }: { intro: Project }) {
  const slides: Slide[] = [
    { kind: "intro", project: intro },
    ...featured.map((project, index) => ({ kind: "featured" as const, project, index })),
  ];
  const [current, setCurrent] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { openPlayer } = usePlayer();

  const slide = slides[current];
  const { project } = slide;
  const isIntro = slide.kind === "intro";
  // The intro loops the full film from its loop point; featured slides loop their 6 s preview.
  const loopSrc = isIntro ? project.src : project.preview;
  const loopStart = isIntro ? INTRO_LOOP_START : 0;
  const videoFailed = failed === loopSrc;

  // Muted background loop, unless the viewer asked for less motion or data,
  // paused it, or the card is off-screen. The poster stays up as the fallback.
  useEffect(() => {
    const video = videoRef.current;
    const root = rootRef.current;
    if (!video || !root) return;
    const allowed = !reducedMotion && !prefersSavingData() && !userPaused;
    const io = new IntersectionObserver(([entry]) => {
      if (allowed && entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    io.observe(root);
    return () => io.disconnect();
  }, [reducedMotion, userPaused, loopSrc]);

  const go = (delta: number) => {
    setPlaying(false);
    setCurrent((c) => (c + delta + slides.length) % slides.length);
  };

  const titleId = "hero-title";

  return (
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-labelledby={titleId}
      className="relative isolate flex min-h-[520px] w-full flex-col overflow-hidden rounded-[28px] bg-scrim lg:aspect-[21/10] lg:max-h-[60svh] lg:min-h-[430px]"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- static poster, also the failure fallback */}
        <img
          key={`poster-${project.slug}`}
          src={project.poster}
          alt=""
          fetchPriority={current === 0 ? "high" : undefined}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          key={loopSrc}
          ref={videoRef}
          src={loopSrc}
          poster={project.poster}
          muted
          loop={!isIntro}
          playsInline
          preload={isIntro ? "auto" : "metadata"}
          tabIndex={-1}
          onLoadedMetadata={(e) => {
            if (e.currentTarget.currentTime < loopStart) e.currentTarget.currentTime = loopStart;
          }}
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={(e) => {
            e.currentTarget.currentTime = loopStart;
            e.currentTarget.play().catch(() => {});
          }}
          onError={() => {
            setPlaying(false);
            setFailed(loopSrc);
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            playing && !videoFailed ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-black/75 via-black/35 to-black/0" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-black/60 via-transparent to-black/20" />

      <div className="flex items-start justify-between gap-3 p-5 sm:p-7">
        <span className="tag">
          {isIntro ? (
            <>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-live" /> Video editing portfolio
            </>
          ) : (
            <>
              <SparkIcon size={12} className="text-hot" /> Featured edit
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            setUserPaused(playing);
            if (!playing) videoRef.current?.play().catch(() => {});
          }}
          disabled={videoFailed}
          aria-label={playing ? "Pause background video" : "Play background video"}
          className="icon-btn icon-btn-glass size-9"
        >
          {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
      </div>

      <div
        key={current}
        aria-live="polite"
        className="rise mt-auto max-w-xl px-5 pb-20 sm:px-7 sm:pb-7"
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {isIntro ? (
            [profile.role, "Content Creator"].map((t) => (
              <span key={t} className="tag">{t}</span>
            ))
          ) : (
            <>
              <span className="tag">{project.format}</span>
              <span className="tag">{categoryTitle(project.category)}</span>
            </>
          )}
        </div>

        <h1
          id={isIntro ? titleId : undefined}
          className={
            isIntro
              ? "text-[clamp(2.4rem,5.4vw,4.25rem)] leading-[1] font-semibold tracking-[-0.03em]"
              : "sr-only"
          }
        >
          {profile.name}
          {!isIntro && ` — ${profile.role}`}
        </h1>
        {!isIntro && (
          <h2 id={titleId} className="text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
            {project.title}
          </h2>
        )}

        {isIntro ? (
          <>
            <p className="mt-3 text-sm font-medium tracking-wide text-fg sm:text-base">
              {profile.positioning.join(" · ")}
            </p>
            <p className="mt-2 max-w-md text-sm text-pretty text-fg-dim sm:text-[15px]">{profile.intro}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-fg-dim sm:text-[15px]">
            {toRuntime(project.durationSeconds)} · {aspectLabel(project)} ·{" "}
            {project.hasAudio ? "With sound" : "Silent"}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {isIntro ? (
            <button
              type="button"
              className="pill-solid"
              onClick={() => openPlayer(showreel, 0, { label: "Showreel" })}
            >
              <PlayIcon size={16} /> Play showreel
            </button>
          ) : (
            <button
              type="button"
              className="pill-solid"
              onClick={() => openPlayer(featured, slide.index, { label: "Featured" })}
            >
              <PlayIcon size={16} /> Watch
            </button>
          )}
          <a href={isIntro ? "#work" : "#about"} className="pill-ghost">
            {isIntro ? "Browse edits" : "About me"}
          </a>
          <a href="#contact" className="icon-btn" aria-label="Contact">
            <MailIcon size={17} />
          </a>
        </div>
      </div>

      <div className="absolute right-5 bottom-5 flex items-center gap-3 sm:right-7 sm:bottom-7">
        <p className="hidden text-xs text-fg-dim tabular-nums sm:block" aria-hidden="true">
          {current + 1} / {slides.length}
        </p>
        <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="icon-btn icon-btn-glass">
          <ChevronLeft />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next slide" className="icon-btn icon-btn-glass">
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}

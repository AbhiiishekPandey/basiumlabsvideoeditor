"use client";

import { useEffect, useRef, useState } from "react";
import { showreel, type Project } from "@/content/projects";
import { gsap } from "@/lib/gsap";
import { toTimecode } from "@/lib/timecode";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { usePlayer } from "./player";

const WORDMARK = "BASIUMLABS";
const HEADLINE = ["Every", "frame,", "on", "purpose."];
// MVP opens on near-black frames; the background loop starts where the
// laptop opens and the screen lights up.
const LOOP_START = 6;

type Status = "idle" | "playing" | "paused" | "error";

function prefersSavingData() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

export function Hero({ project }: { project: Project }) {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const userPausedRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const { openPlayer } = usePlayer();
  const [status, setStatus] = useState<Status>("idle");
  const [hasPlayed, setHasPlayed] = useState(false);
  const [muted, setMuted] = useState(true);
  const playing = status === "playing";

  // Muted autoplay unless the viewer asked for less motion or less data.
  // If the browser refuses, the poster stays up and the Play control works.
  useEffect(() => {
    const video = videoRef.current;
    // Metadata may have loaded before hydration attached onLoadedMetadata, so
    // apply the loop start here too (before metadata, this sets the default
    // playback start position).
    if (video && video.currentTime < LOOP_START) video.currentTime = LOOP_START;
    if (!video || reducedMotion || prefersSavingData()) {
      video?.pause();
      return;
    }
    userPausedRef.current = false;
    // The video is server-rendered, so it can fail before hydration attaches
    // onError; check video.error whenever a play attempt is refused.
    video.play().catch(() => setStatus((s) => (video.error ? "error" : s === "error" ? s : "paused")));
  }, [reducedMotion]);

  // Pause off-screen; resume on return unless the viewer paused it.
  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return;
    const io = new IntersectionObserver(([entry]) => {
      // Also catches a pre-hydration load failure when autoplay never ran.
      if (video.error) setStatus("error");
      else if (!entry.isIntersecting) video.pause();
      else if (hasPlayed && !userPausedRef.current) video.play().catch(() => {});
    });
    io.observe(root);
    return () => io.disconnect();
  }, [hasPlayed]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && timecodeRef.current) timecodeRef.current.textContent = toTimecode(v.currentTime, project.fps);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [project.fps]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .from("[data-hero-media]", { scale: 1.12, duration: 2.4, ease: "power2.out" }, 0)
        .from("[data-hero-letter]", { yPercent: 105, duration: 1, stagger: 0.04 }, 0.1)
        .from("[data-hero-word]", { yPercent: 110, duration: 0.9, stagger: 0.08 }, 0.35)
        // Hard cuts: labels and controls snap in on their own frames.
        .from("[data-hero-cut]", { autoAlpha: 0, duration: 0.01, stagger: 0.12 }, 0.7);

      // Scroll: the frame pushes in and the wordmark drifts up as you leave.
      gsap
        .timeline({ scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0.4 } })
        .to("[data-hero-media]", { scale: 1.1, ease: "none" }, 0)
        .to("[data-hero-shade]", { opacity: 0.85, ease: "none" }, 0)
        .to("[data-hero-wordmark]", { yPercent: -18, ease: "none" }, 0);
    });
    return () => mm.revert();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || status === "error") return;
    if (playing) {
      userPausedRef.current = true;
      video.pause();
    } else {
      userPausedRef.current = false;
      if (video.currentTime < LOOP_START) video.currentTime = LOOP_START;
      video.play().catch(() => setStatus("paused"));
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video || status === "error") return;
    video.muted = !muted;
    setMuted(!muted);
    if (muted && video.paused) {
      userPausedRef.current = false;
      video.play().catch(() => {});
    }
  };

  return (
    <section
      ref={rootRef}
      aria-labelledby="hero-title"
      className="relative isolate flex h-svh min-h-[600px] flex-col overflow-hidden"
    >
      <div data-hero-media aria-hidden="true" className="absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- static poster, also the failure fallback */}
        <img
          src={project.poster}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          ref={videoRef}
          src={project.src}
          poster={project.poster}
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
          onLoadedMetadata={(e) => {
            if (e.currentTarget.currentTime < LOOP_START) e.currentTarget.currentTime = LOOP_START;
          }}
          onPlaying={() => {
            setStatus("playing");
            setHasPlayed(true);
          }}
          onPause={() => setStatus((s) => (s === "error" ? s : "paused"))}
          onEnded={(e) => {
            e.currentTarget.currentTime = LOOP_START;
            e.currentTarget.play().catch(() => {});
          }}
          onError={() => setStatus("error")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            hasPlayed && status !== "error" ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
      <div data-hero-shade aria-hidden="true" className="absolute inset-0 -z-10 bg-ink opacity-30" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/15 to-ink/55" />

      <div className="flex items-start justify-between px-4 pt-20 font-mono text-[11px] tracking-[0.18em] uppercase sm:px-8 sm:pt-24 sm:text-xs">
        <p data-hero-cut className="text-bone/80">
          Video editing studio
          <span className="block text-bone-dim">Product · Long form · Short form</span>
        </p>
        <p data-hero-cut className="text-right text-bone/80" aria-live="polite">
          <span className="flex items-center justify-end gap-2">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full bg-rec ${playing ? "animate-[rec_1.6s_steps(2)_infinite]" : "opacity-40"}`}
            />
            <span>{status === "error" ? "Offline" : playing ? "Rec" : "Hold"}</span>
            <span ref={timecodeRef} aria-hidden="true" className="text-bone tabular-nums">
              00:00:00:00
            </span>
          </span>
          <span className="block text-bone-dim">A001 · {project.title}</span>
        </p>
      </div>

      <div className="mt-auto px-4 sm:px-8">
        <p className="max-w-[18ch] text-[clamp(2.25rem,6.2vw,5.5rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance">
          {HEADLINE.map((word, i) => (
            <span key={i} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
              <span data-hero-word className="inline-block">{word}</span>
            </span>
          ))}
        </p>
        <p data-hero-cut className="mt-4 max-w-md text-base text-pretty text-bone/85 sm:text-lg">
          Basiumlabs edits product launches, long-form stories and short-form social — built on
          rhythm, pacing and the cut.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div data-hero-cut className="flex flex-wrap gap-2">
            <a href="#work" className="btn-solid">
              View work ↓
            </a>
            <button
              type="button"
              className="btn-ghost-lg"
              onClick={() => openPlayer(showreel, 0, { label: "Showreel" })}
            >
              <span aria-hidden="true" className="text-rec">▶</span> Play showreel
            </button>
          </div>
          <div data-hero-cut className="flex gap-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={status === "error"}
              aria-label={playing ? "Pause background film" : "Play background film"}
              className="btn-ghost"
            >
              {playing ? "❚❚ Pause" : "▶ Play"}
            </button>
            <button
              type="button"
              onClick={toggleSound}
              disabled={status === "error"}
              aria-pressed={!muted}
              aria-label="Background film sound"
              className="btn-ghost"
            >
              {muted ? "Sound off" : "Sound on"}
            </button>
          </div>
        </div>
      </div>

      <h1
        id="hero-title"
        data-hero-wordmark
        className="mt-6 flex overflow-hidden px-4 pb-4 font-display text-[calc((100vw-2rem)/4.7)] leading-[0.82] uppercase sm:px-8 sm:pb-6 sm:text-[calc((100vw-4rem)/4.7)]"
      >
        <span className="sr-only">Basiumlabs — video editing studio</span>
        {WORDMARK.split("").map((letter, i) => (
          <span key={i} data-hero-letter aria-hidden="true" className="inline-block">
            {letter}
          </span>
        ))}
      </h1>
    </section>
  );
}

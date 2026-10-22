"use client";

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/content/projects";
import { toRuntime, toSpokenRuntime, toTimecode } from "@/lib/timecode";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Props = {
  project: Project;
  onPlay: () => void;
  /** Clip label, e.g. "01·02". */
  clip: string;
  className?: string;
};

// Poster first; the muted preview is attached only when the frame nears the
// viewport and plays only while mostly visible. Never under reduced motion.
export function ProjectFrame({ project, onPlay, clip, className = "" }: Props) {
  const frameRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const showPreview = near && !reducedMotion;

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    const video = videoRef.current;
    if (!showPreview || !el || !video) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      video.pause();
    };
  }, [showPreview]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && timecodeRef.current) {
        timecodeRef.current.textContent = toTimecode(project.previewStart + v.currentTime, project.fps);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, project]);

  return (
    <button
      ref={frameRef}
      type="button"
      onClick={onPlay}
      data-cursor="Play"
      aria-label={`Play ${project.title}, ${project.format}, ${toSpokenRuntime(project.durationSeconds)}`}
      className={`group relative block overflow-hidden bg-ink-2 ${className}`}
      style={{ aspectRatio: `${project.width} / ${project.height}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- poster is a pre-sized static encode */}
      <img
        src={project.poster}
        alt=""
        width={project.width}
        height={project.height}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
      />
      {showPreview && (
        <video
          ref={videoRef}
          src={project.preview}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setPlaying(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.03] ${
            playing ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-ink/80 to-transparent" />
      <span aria-hidden="true" className="absolute inset-0 ring-1 ring-bone/0 ring-inset transition duration-300 group-hover:ring-bone/30 group-focus-visible:ring-rec" />

      <span aria-hidden="true" className="absolute top-2.5 left-2.5 bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.15em] text-bone uppercase">
        {clip}
      </span>
      <span
        aria-hidden="true"
        className={`absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] tabular-nums transition-opacity ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="size-1.5 rounded-full bg-rec" />
        <span ref={timecodeRef}>{toTimecode(project.previewStart, project.fps)}</span>
      </span>

      <span
        aria-hidden="true"
        className="absolute bottom-2.5 left-2.5 flex items-center gap-2 bg-bone px-2.5 py-1.5 font-mono text-[10px] tracking-[0.15em] text-ink uppercase transition-colors duration-200 group-hover:bg-rec group-hover:text-bone group-focus-visible:bg-rec group-focus-visible:text-bone"
      >
        <span>▶</span> Play · {toRuntime(project.durationSeconds)}
      </span>
    </button>
  );
}

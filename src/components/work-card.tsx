"use client";

import { useState } from "react";
import { categoryTitle, type Project } from "@/content/projects";
import { toRuntime, toSpokenRuntime } from "@/lib/timecode";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { PlayIcon } from "./icons";

type Props = {
  project: Project;
  onPlay: () => void;
  /** "card": portrait card with details (main row). "tile": compact landscape tile (side column). */
  variant?: "card" | "tile";
  className?: string;
};

// Poster first; the muted 6 s preview is attached on hover or keyboard focus
// and never under reduced motion.
export function WorkCard({ project, onPlay, variant = "card", className = "" }: Props) {
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const showPreview = active && !reducedMotion;

  const start = () => setActive(true);
  const stop = () => {
    setActive(false);
    setPlaying(false);
  };

  const card = variant === "card";

  return (
    <button
      type="button"
      onClick={onPlay}
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
      aria-label={`Play ${project.title}, ${project.format}, ${toSpokenRuntime(project.durationSeconds)}`}
      className={`group relative block w-full overflow-hidden rounded-[20px] bg-scrim text-left ${
        card ? "aspect-[4/5] lg:aspect-[5/6]" : "aspect-[5/4]"
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- poster is a pre-sized static encode */}
      <img
        src={project.poster}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />
      {showPreview && (
        <video
          src={project.preview}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onError={() => setPlaying(false)}
          className={`absolute inset-0 h-full w-full scale-[1.04] object-cover transition-opacity duration-500 ${
            playing ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      <span
        aria-hidden="true"
        className={`absolute inset-0 bg-linear-to-t ${card ? "from-black/85 via-black/25" : "from-black/80 via-black/10"} to-transparent`}
      />
      <span aria-hidden="true" className="absolute inset-0 rounded-[20px] ring-1 ring-white/10 ring-inset transition group-hover:ring-white/30" />

      {card ? (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3.5">
          <span className="tag hidden self-start sm:inline-flex">{categoryTitle(project.category)}</span>
          <span className="text-[15px] leading-tight font-semibold">{project.title}</span>
          <span className="flex items-end justify-between gap-2">
            <span className="text-xs leading-snug text-fg-dim">
              {project.format}
              <br />
              {toRuntime(project.durationSeconds)}
            </span>
            <span className="play-disc">
              <PlayIcon size={14} />
            </span>
          </span>
        </span>
      ) : (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{project.title}</span>
            <span className="block truncate text-[11px] text-fg-dim">{project.format}</span>
          </span>
          <span className="play-disc play-disc-sm">
            <PlayIcon size={11} />
          </span>
        </span>
      )}
    </button>
  );
}

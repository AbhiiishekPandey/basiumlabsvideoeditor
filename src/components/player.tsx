"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { categories, type Project } from "@/content/projects";
import { toRuntime, toSpokenRuntime, toTimecode } from "@/lib/timecode";
import { useMediaQuery } from "@/lib/use-media-query";
import { ChevronLeft, ChevronRight } from "./icons";

type OpenOptions = { label?: string };
type PlayerApi = { openPlayer: (queue: Project[], index?: number, opts?: OpenOptions) => void };

const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

/** `id` is unique per open, so a late close can't cancel a newer session. */
type Session = { id: number; queue: Project[]; index: number; label?: string };

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const nextId = useRef(0);

  const openPlayer = useCallback<PlayerApi["openPlayer"]>((queue, index = 0, opts) => {
    if (queue.length) setSession({ id: ++nextId.current, queue, index, label: opts?.label });
  }, []);
  const api = useMemo(() => ({ openPlayer }), [openPlayer]);

  return (
    <PlayerContext.Provider value={api}>
      {children}
      <PlayerDialog
        session={session}
        onIndex={(index) => setSession((s) => (s ? { ...s, index } : s))}
        onClose={(id) => setSession((s) => (s?.id === id ? null : s))}
      />
    </PlayerContext.Provider>
  );
}

type DialogProps = {
  session: Session | null;
  onIndex: (index: number) => void;
  onClose: (sessionId: number) => void;
};

// Native <dialog>: focus trapping, Esc to close and focus return come free.
// Native video controls keep playback keyboard- and screen-reader-accessible.
function PlayerDialog({ session, onIndex, onClose }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const [attempt, setAttempt] = useState(0);
  // Error is tied to a specific load, so switching piece or retrying clears it.
  const [failedLoad, setFailedLoad] = useState<string | null>(null);
  const large = useMediaQuery("(min-width: 1024px)");

  const project = session ? session.queue[session.index] : null;
  const total = session?.queue.length ?? 0;
  const index = session?.index ?? 0;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;
  const src = project ? ((large && project.srcHd) || project.src) : undefined;
  const loadKey = `${src}#${attempt}`;
  const failed = failedLoad === loadKey;
  const markFailed = () => setFailedLoad(loadKey);

  // Native close (Esc, close button, backdrop) doesn't reliably reach React's
  // onClose, so listen directly. The close event is async and can land after
  // a new piece was requested but before it rendered; closing by the id of
  // the session that was actually showing keeps that newer request alive.
  const onCloseRef = useRef(onClose);
  const shownIdRef = useRef<number | null>(null);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      if (dialog.open) return;
      videoRef.current?.pause();
      if (shownIdRef.current !== null) onCloseRef.current(shownIdRef.current);
      shownIdRef.current = null;
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  const sessionId = session?.id ?? null;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    shownIdRef.current = sessionId;
    if (sessionId !== null && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs while the dialog is still closed, so focus the
      // video once it is actually focusable: Space/arrows then control playback.
      videoRef.current?.focus();
    } else if (sessionId === null && dialog.open) dialog.close();
  }, [sessionId]);

  // New piece (or retry): reset error state, load and play with sound.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    // Switching piece remounts the video; if it held focus, focus fell to the
    // body and keyboard shortcuts stopped reaching the dialog. Take it back.
    const dialog = dialogRef.current;
    if (dialog?.open && !dialog.contains(document.activeElement)) video.focus();
    video.load();
    video.play().catch(() => {
      // Autoplay refused: native controls stay available to start it.
    });
  }, [src, attempt]);

  useEffect(() => {
    if (sessionId === null) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && timecodeRef.current && project) {
        timecodeRef.current.textContent = toTimecode(v.currentTime, project.fps);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sessionId, project]);

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < total) onIndex(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "]" || e.key.toLowerCase() === "n") go(1);
    else if (e.key === "[" || e.key.toLowerCase() === "p") go(-1);
    else return;
    e.preventDefault();
  };

  const category = categories.find((c) => c.id === project?.category);
  const titleId = "player-title";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t === e.currentTarget || t.dataset.backdrop !== undefined) dialogRef.current?.close();
      }}
      className="player m-0 h-svh max-h-none w-screen max-w-none bg-transparent p-2 text-fg sm:p-6"
    >
      {project && (
        <div className="glass flex h-full flex-col gap-3 rounded-[28px] p-3 sm:gap-4 sm:rounded-[36px] sm:p-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="tag">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-live" />
                {session?.label ?? category?.title}
              </span>
              {total > 1 && (
                <span className="text-xs text-fg-dim tabular-nums">
                  {index + 1} / {total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {total > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} disabled={!hasPrev} className="icon-btn" aria-label="Previous" aria-keyshortcuts="P">
                    <ChevronLeft />
                  </button>
                  <button type="button" onClick={() => go(1)} disabled={!hasNext} className="icon-btn" aria-label="Next" aria-keyshortcuts="N">
                    <ChevronRight />
                  </button>
                </>
              )}
              <button type="button" onClick={() => dialogRef.current?.close()} className="pill-ghost pill-sm">
                Close <span className="text-fg-faint">Esc</span>
              </button>
            </div>
          </header>

          {/* A size container, so the video can be the largest box of its own ratio that fits. */}
          <div
            data-backdrop
            className="relative flex min-h-0 flex-1 items-center justify-center"
            style={{ containerType: "size" }}
          >
            {/* key: remount per piece so the poster never flashes the old frame */}
            <video
              key={project.slug}
              ref={videoRef}
              className="rounded-[20px] bg-black"
              style={{
                aspectRatio: `${project.width} / ${project.height}`,
                width: `min(100cqw, 100cqh * ${project.width / project.height})`,
              }}
              poster={project.poster}
              controls
              playsInline
              preload="none"
              aria-describedby="player-meta"
              onError={markFailed}
              onEnded={() => hasNext && go(1)}
            >
              <source src={src} type="video/mp4" onError={markFailed} />
            </video>
            {failed && (
              <div
                role="alert"
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[20px] bg-black/70 text-center"
              >
                <p className="text-xs font-medium tracking-[0.14em] text-fg-faint uppercase">Playback error</p>
                <p className="max-w-xs">This video couldn&apos;t be loaded.</p>
                <button type="button" className="pill-solid" onClick={() => setAttempt((a) => a + 1)}>
                  Retry
                </button>
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1">
            <div>
              <h2 id={titleId} className="text-2xl leading-tight font-semibold tracking-[-0.02em] sm:text-3xl">
                {project.title}
              </h2>
              <p id="player-meta" className="mt-1 text-sm text-fg-dim">
                {project.format} · {category?.title} ·{" "}
                <span aria-hidden="true">{toRuntime(project.durationSeconds)}</span>
                <span className="sr-only">{toSpokenRuntime(project.durationSeconds)}</span>
              </p>
            </div>
            <p aria-hidden="true" className="text-xs text-fg-dim tabular-nums">
              <span ref={timecodeRef} className="text-fg">00:00:00:00</span>
              <span> / {toTimecode(project.durationSeconds, project.fps)}</span>
            </p>
          </footer>

          {total > 1 && (
            <nav aria-label="Up next" className="no-scrollbar -mx-3 overflow-x-auto px-3 sm:-mx-5 sm:px-5">
              <ol className="flex gap-2">
                {session?.queue.map((p, i) => (
                  <li key={p.slug} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => onIndex(i)}
                      aria-current={i === index ? "true" : undefined}
                      aria-label={`${i + 1}. ${p.title}, ${p.format}`}
                      className={`relative block h-12 overflow-hidden rounded-xl ring-2 transition sm:h-14 ${
                        i === index ? "ring-white" : "opacity-55 ring-transparent hover:opacity-100"
                      }`}
                      style={{ aspectRatio: `${p.width} / ${p.height}` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>
      )}
    </dialog>
  );
}

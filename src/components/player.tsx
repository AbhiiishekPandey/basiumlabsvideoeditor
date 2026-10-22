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
import { categories, isVertical, type Project } from "@/content/projects";
import { toRuntime, toSpokenRuntime, toTimecode } from "@/lib/timecode";
import { useMediaQuery } from "@/lib/use-media-query";

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
      className="player m-0 h-svh max-h-none w-screen max-w-none bg-ink/95 p-0 text-bone"
    >
      {project && (
        <div className="flex h-full flex-col gap-3 px-4 py-4 sm:px-8 sm:py-6">
          <header className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] tracking-[0.15em] uppercase sm:text-xs">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex items-center gap-2 text-rec">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-rec" />
                {session?.label ?? category?.title}
              </span>
              {total > 1 && (
                <span className="text-bone-dim tabular-nums">
                  {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {total > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} disabled={!hasPrev} className="btn-ghost" aria-keyshortcuts="P">
                    ← Prev
                  </button>
                  <button type="button" onClick={() => go(1)} disabled={!hasNext} className="btn-ghost" aria-keyshortcuts="N">
                    Next →
                  </button>
                </>
              )}
              <button type="button" onClick={() => dialogRef.current?.close()} className="btn-ghost">
                Close <span className="text-bone-dim">Esc</span>
              </button>
            </div>
          </header>

          <div data-backdrop className="relative flex min-h-0 flex-1 items-center justify-center">
            {/* key: remount per piece so the poster never flashes the old frame */}
            <video
              key={project.slug}
              ref={videoRef}
              className="max-h-full max-w-full bg-ink-2"
              style={{
                aspectRatio: `${project.width} / ${project.height}`,
                height: isVertical(project) ? "100%" : undefined,
                width: isVertical(project) ? undefined : "100%",
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
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink/85 text-center"
              >
                <p className="font-mono text-xs tracking-[0.15em] text-bone-dim uppercase">
                  Signal lost
                </p>
                <p className="max-w-xs text-bone">This video couldn&apos;t be loaded.</p>
                <button type="button" className="btn-solid" onClick={() => setAttempt((a) => a + 1)}>
                  Retry
                </button>
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h2 id={titleId} className="font-display text-3xl leading-none uppercase sm:text-4xl">
                {project.title}
              </h2>
              <p id="player-meta" className="mt-2 font-mono text-[11px] tracking-[0.15em] text-bone-dim uppercase sm:text-xs">
                {project.format} · {category?.title} ·{" "}
                <span aria-hidden="true">{toRuntime(project.durationSeconds)}</span>
                <span className="sr-only">{toSpokenRuntime(project.durationSeconds)}</span>
              </p>
            </div>
            <p aria-hidden="true" className="font-mono text-xs tracking-[0.15em] tabular-nums">
              <span ref={timecodeRef}>00:00:00:00</span>
              <span className="text-bone-dim"> / {toTimecode(project.durationSeconds, project.fps)}</span>
            </p>
          </footer>

          {total > 1 && (
            <nav aria-label="Up next" className="-mx-4 overflow-x-auto px-4 sm:-mx-8 sm:px-8">
              <ol className="flex gap-2">
                {session?.queue.map((p, i) => (
                  <li key={p.slug} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => onIndex(i)}
                      aria-current={i === index ? "true" : undefined}
                      aria-label={`${i + 1}. ${p.title}, ${p.format}`}
                      className={`relative block h-12 overflow-hidden border transition-colors sm:h-14 ${
                        i === index ? "border-rec" : "border-transparent opacity-50 hover:opacity-100"
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

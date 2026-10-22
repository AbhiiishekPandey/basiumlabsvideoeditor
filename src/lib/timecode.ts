export const FPS = 30;

const pad = (n: number) => String(n).padStart(2, "0");

/** SMPTE-style HH:MM:SS:FF */
export function toTimecode(seconds: number, fps = FPS): string {
  const totalFrames = Math.max(0, Math.floor(seconds * fps));
  const ff = totalFrames % fps;
  const s = Math.floor(totalFrames / fps);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`;
}

/** Human runtime, e.g. 0:43 or 1:02:05 */
export function toRuntime(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Spoken runtime for screen readers, e.g. "3 minutes 52 seconds" */
export function toSpokenRuntime(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const parts = [m && `${m} minute${m === 1 ? "" : "s"}`, s % 60 && `${s % 60} seconds`];
  return parts.filter(Boolean).join(" ");
}

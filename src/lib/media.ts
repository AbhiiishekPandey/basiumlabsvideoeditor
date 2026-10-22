// All media URLs go through here so assets can live on an external host.
// NEXT_PUBLIC_MEDIA_BASE_URL is inlined at build time (changing it needs a
// rebuild). URLs are `${base}/${slug}/${file}`, e.g.
// https://media.example.com/tedx-trailer/hd.mp4. Defaults to /media
// (public/media) for local development.
const MEDIA_BASE_URL = (
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "/media"
).replace(/\/+$/, "");

export function mediaUrl(file: string): string {
  return `${MEDIA_BASE_URL}/${file.replace(/^\/+/, "")}`;
}

/** Origin of the media host when it is external, for preconnect hints. */
export const mediaOrigin: string | null = /^https?:\/\//.test(MEDIA_BASE_URL)
  ? new URL(MEDIA_BASE_URL).origin
  : null;

#!/usr/bin/env node
// Builds web media for every project in src/content/catalog.json and writes
// measured metadata to src/content/media-manifest.json.
//
// Originals are only read. Outputs go to public/media/<slug>/:
//   sd.mp4       full piece, long edge <= 1280 (mobile + default)
//   hd.mp4       full piece, long edge <= 1920 (only if the source is larger)
//   preview.mp4  6s muted loop, long edge <= 960
//   poster.jpg   still, long edge <= 1280
//
// Usage: node scripts/encode-media.mjs [--force] [slug ...]
// Env:   MEDIA_SOURCE_ROOT (default: parent of this project)

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = resolve(process.env.MEDIA_SOURCE_ROOT ?? join(ROOT, ".."));
const OUT_ROOT = join(ROOT, "public", "media");
const CATALOG = join(ROOT, "src", "content", "catalog.json");
const MANIFEST = join(ROOT, "src", "content", "media-manifest.json");
const PREVIEW_SECONDS = 6;

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr.trim().split("\n").slice(-3).join(" | ")}`);
  return r.stdout;
}

function probe(file) {
  const json = JSON.parse(
    run("ffprobe", ["-v", "error", "-show_entries",
      "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", file]),
  );
  const video = json.streams.find((s) => s.codec_type === "video");
  const [num, den] = video.r_frame_rate.split("/").map(Number);
  return {
    width: video.width,
    height: video.height,
    fps: Math.round(num / den),
    duration: Number(Number(json.format.duration).toFixed(3)),
    hasAudio: json.streams.some((s) => s.codec_type === "audio"),
  };
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

// Scale so the long edge is at most `max`, never upscaling.
function fit(w, h, max) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: even(w * scale), h: even(h * scale) };
}

// Writes to a temp name, then renames, so an interrupted run never leaves a
// half-written file that a later run would skip.
function ffmpeg(outFile, ffArgs) {
  if (existsSync(outFile) && !force) return "kept";
  const tmp = outFile.replace(/(\.\w+)$/, ".partial$1");
  run("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...ffArgs, tmp]);
  renameSync(tmp, outFile);
  return "built";
}

const x264 = (crf, maxrate) => [
  "-c:v", "libx264", "-preset", "medium", "-crf", String(crf),
  "-maxrate", maxrate, "-bufsize", `${parseFloat(maxrate) * 2}M`,
  "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
];

const catalog = JSON.parse(readFileSync(CATALOG, "utf8")).projects;
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
let failures = 0;

for (const item of catalog) {
  if (only.length && !only.includes(item.slug)) continue;
  const src = join(SOURCE_ROOT, item.source);
  const outDir = join(OUT_ROOT, item.slug);
  try {
    if (!existsSync(src)) throw new Error(`source missing: ${src}`);
    mkdirSync(outDir, { recursive: true });

    const source = probe(src);
    const rotate = item.rotate === "ccw" ? "transpose=2" : item.rotate === "cw" ? "transpose=1" : null;
    const [w, h] = rotate ? [source.height, source.width] : [source.width, source.height];
    const vf = (max) => {
      const t = fit(w, h, max);
      return [rotate, `scale=${t.w}:${t.h}:flags=lanczos`].filter(Boolean).join(",");
    };
    const audio = source.hasAudio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"];
    const status = {};

    status.sd = ffmpeg(join(outDir, "sd.mp4"), ["-i", src, "-vf", vf(1280), ...x264(23, "2.5M"), ...audio]);
    const hasHd = Math.max(w, h) > 1280;
    if (hasHd) {
      status.hd = ffmpeg(join(outDir, "hd.mp4"), ["-i", src, "-vf", vf(1920), ...x264(22, "6M"), ...audio]);
    }
    const previewStart = Math.max(0, Math.min(item.previewStart, source.duration - PREVIEW_SECONDS));
    status.preview = ffmpeg(join(outDir, "preview.mp4"), [
      "-ss", String(previewStart), "-t", String(PREVIEW_SECONDS), "-i", src,
      "-vf", vf(960), ...x264(28, "1.2M"), "-an",
    ]);
    status.poster = ffmpeg(join(outDir, "poster.jpg"), [
      "-ss", String(Math.min(item.posterAt, source.duration - 0.5)), "-i", src,
      "-frames:v", "1", "-vf", vf(1280), "-q:v", "4",
    ]);

    // Metadata comes from the encoded output, not the catalog.
    const sd = probe(join(outDir, "sd.mp4"));
    const files = { sd: "sd.mp4", preview: "preview.mp4", poster: "poster.jpg", ...(hasHd && { hd: "hd.mp4" }) };
    const bytes = Object.fromEntries(
      Object.entries(files).map(([k, f]) => [k, statSync(join(outDir, f)).size]),
    );
    const hd = hasHd ? probe(join(outDir, "hd.mp4")) : null;
    manifest[item.slug] = {
      width: sd.width,
      height: sd.height,
      fps: sd.fps,
      duration: sd.duration,
      hasAudio: sd.hasAudio,
      previewStart,
      previewDuration: PREVIEW_SECONDS,
      files,
      ...(hd && { hd: { width: hd.width, height: hd.height } }),
      bytes,
      source: {
        file: item.source.split("/").pop(),
        folder: item.source.split("/")[0],
        width: source.width,
        height: source.height,
        bytes: statSync(src).size,
      },
    };
    console.log(`ok   ${item.slug.padEnd(24)} ${sd.width}x${sd.height} ${sd.duration}s ${JSON.stringify(status)}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${item.slug}: ${err.message}`);
  }
}

// Keep manifest keys in catalog order for stable diffs.
const ordered = Object.fromEntries(catalog.filter((c) => manifest[c.slug]).map((c) => [c.slug, manifest[c.slug]]));
writeFileSync(MANIFEST, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`manifest: ${Object.keys(ordered).length}/${catalog.length} projects`);
process.exit(failures ? 1 : 0);

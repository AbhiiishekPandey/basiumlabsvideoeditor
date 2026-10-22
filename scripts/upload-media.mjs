#!/usr/bin/env node
// Uploads every file listed in src/content/media-manifest.json from
// public/media/<slug>/<file> to a Cloudflare R2 bucket at key <slug>/<file>,
// matching the URLs the site builds from NEXT_PUBLIC_MEDIA_BASE_URL.
//
// Auth comes from `npx wrangler login` on this machine; no credentials are
// read from or written to the project.
//
// Usage: node scripts/upload-media.mjs <bucket>          # dry run: prints the plan
//        node scripts/upload-media.mjs <bucket> --yes    # uploads

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = "wrangler@4";
const CACHE_CONTROL = "public, max-age=604800";
const TYPES = { ".mp4": "video/mp4", ".jpg": "image/jpeg" };
const MAX_BYTES = 300 * 1024 * 1024; // wrangler single-request upload limit

const [bucket] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const upload = process.argv.includes("--yes");
if (!bucket) {
  console.error("Usage: node scripts/upload-media.mjs <bucket> [--yes]");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(ROOT, "src/content/media-manifest.json"), "utf8"));
const jobs = Object.entries(manifest).flatMap(([slug, m]) =>
  ["sd", "hd", "preview", "poster"]
    .filter((k) => m.files[k])
    .map((k) => ({ key: `${slug}/${m.files[k]}`, file: join(ROOT, "public/media", slug, m.files[k]), bytes: m.bytes[k] })),
);

// Validate everything before touching the bucket.
const problems = jobs.flatMap((j) => {
  if (!existsSync(j.file)) return [`missing ${j.key} (run npm run media:encode)`];
  const size = statSync(j.file).size;
  if (size !== j.bytes) return [`${j.key} is ${size} bytes, manifest says ${j.bytes} (re-run the encoder)`];
  if (size > MAX_BYTES) return [`${j.key} exceeds 300 MiB; upload it with rclone or the dashboard`];
  return [];
});
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const totalMb = (jobs.reduce((s, j) => s + j.bytes, 0) / 1048576).toFixed(1);
console.log(`${jobs.length} files, ${totalMb} MB → r2://${bucket}/  (${upload ? "uploading" : "dry run; add --yes to upload"})`);

for (const [i, j] of jobs.entries()) {
  const ext = j.key.slice(j.key.lastIndexOf("."));
  const args = [
    "--yes", WRANGLER, "r2", "object", "put", `${bucket}/${j.key}`,
    "--file", j.file, "--content-type", TYPES[ext], "--cache-control", CACHE_CONTROL, "--remote",
  ];
  const label = `[${String(i + 1).padStart(2)}/${jobs.length}] ${j.key} (${(j.bytes / 1048576).toFixed(1)} MB)`;
  if (!upload) {
    console.log(label);
    continue;
  }
  console.log(label);
  // npx is a .cmd shim on Windows, which needs a shell; quote every argument.
  const win = process.platform === "win32";
  const r = spawnSync(win ? `npx ${args.map((a) => `"${a}"`).join(" ")}` : "npx", win ? [] : args, {
    stdio: "inherit",
    shell: win,
  });
  if (r.status !== 0) {
    console.error(`Upload failed at ${j.key}. Fix the error above and re-run; finished files are simply overwritten.`);
    process.exit(1);
  }
}
if (upload) console.log("Done. Verify with: node scripts/browser-check.mjs --url <site> --media <NEXT_PUBLIC_MEDIA_BASE_URL>");

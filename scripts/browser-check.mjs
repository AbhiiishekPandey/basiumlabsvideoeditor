#!/usr/bin/env node
// End-to-end checks against a running build, via the Chrome DevTools Protocol
// (no dependencies; drives a locally installed Edge or Chrome).
//
// Usage: node scripts/browser-check.mjs [--url http://localhost:3100] [--media <base>] [--out ./qa]
//   --media: the NEXT_PUBLIC_MEDIA_BASE_URL the site was built with (default <url>/media)
// Env:   BROWSER=<path to chrome/msedge>

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = arg("--url", "http://localhost:3100");
const MEDIA = arg("--media", `${BASE}/media`).replace(/\/+$/, "");
const OUT = resolve(arg("--out", join(tmpdir(), "basiumlabs-qa")));
mkdirSync(OUT, { recursive: true });

const BROWSER =
  process.env.BROWSER ??
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find(existsSync);

const manifest = JSON.parse(readFileSync(join(ROOT, "src/content/media-manifest.json"), "utf8"));
const catalog = JSON.parse(readFileSync(join(ROOT, "src/content/catalog.json"), "utf8")).projects;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

// ---------- 1. Assets over HTTP ----------
for (const [slug, m] of Object.entries(manifest)) {
  for (const key of ["sd", "hd", "preview", "poster"]) {
    const file = m.files[key];
    if (!file) continue;
    const res = await fetch(`${MEDIA}/${slug}/${file}`, { headers: { Range: "bytes=0-0" } });
    const total = Number(res.headers.get("content-range")?.split("/")[1]);
    const type = res.headers.get("content-type") ?? "";
    check(`asset ${slug}/${file}`, res.status === 206 && total === m.bytes[key] && /^(video\/mp4|image\/jpeg)/.test(type),
      `status ${res.status}, ${total} bytes, ${type}`);
  }
}

// ---------- 1b. Branding and headers ----------
{
  const res = await fetch(BASE);
  const html = await res.text();
  check("branding: tab title", html.includes("<title>Basiumlabs — Video Editing Portfolio</title>"));
  check("branding: svg + ico + apple icons linked",
    /<link rel="icon" href="\/icon\.svg[^"]*"[^>]*type="image\/svg\+xml"/.test(html) &&
    /<link rel="icon" href="\/favicon\.ico/.test(html) && /<link rel="apple-touch-icon" href="\/apple-icon\.png/.test(html));
  // Same-origin media (the local default) is referenced by path and needs no
  // preconnect; external media is referenced by full URL.
  const sameOrigin = new URL(MEDIA).origin === new URL(BASE).origin;
  const mediaRef = sameOrigin ? new URL(MEDIA).pathname : MEDIA;
  if (!sameOrigin) {
    // React may deliver the hint as an HTTP Link header instead of a <link> tag.
    const origin = new URL(MEDIA).origin;
    const linkHeader = res.headers.get("link") ?? "";
    check("media: preconnect to media origin",
      linkHeader.includes(`<${origin}>; rel=preconnect`) || html.includes(`<link rel="preconnect" href="${origin}"`), origin);
  }
  check("branding: no X-Powered-By header", !res.headers.get("x-powered-by"), res.headers.get("x-powered-by") ?? "absent");
  check("branding: no starter text in page", !/next\.js|create next app|vercel\.svg|next\.svg/i.test(html));
  check("media: page references configured media base", html.includes(`${mediaRef}/mvp/`), mediaRef);
  for (const path of ["/favicon.ico", "/icon.svg", "/apple-icon.png"]) {
    const r = await fetch(BASE + path);
    check(`branding: ${path} served`, r.ok, `${r.status} ${r.headers.get("content-type")}`);
  }
  for (const path of ["/next.svg", "/vercel.svg"]) {
    check(`branding: ${path} removed`, (await fetch(BASE + path)).status === 404);
  }
  const nf = await fetch(`${BASE}/definitely-not-a-page`);
  const nfHtml = await nf.text();
  check("branding: 404 page is Basiumlabs-branded",
    nf.status === 404 && nfHtml.includes("Off the timeline") && nfHtml.includes("<title>Page not found — Basiumlabs</title>"),
    `status ${nf.status}`);
}

// ---------- 2. Browser session helpers ----------
async function session({ width, height, reducedMotion = false, blockVideo = false }) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = mkdtempSync(join(tmpdir(), "bl-cdp-"));
  const proc = spawn(BROWSER, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-renderer-backgrounding", "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, "about:blank",
  ]);
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
    return r.result?.result?.value;
  };
  const waitFor = async (expression, timeout = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await evaluate(expression)) return true;
      await sleep(150);
    }
    return false;
  };
  const key = async (k, code, keyCode) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: keyCode });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: keyCode });
  };
  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.result.data, "base64"));
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Page.bringToFront");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  if (reducedMotion) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  }
  if (blockVideo) await send("Network.setBlockedURLs", { urls: ["*.mp4"] });
  await send("Page.navigate", { url: BASE });
  await waitFor("document.readyState === 'complete'", 15000);

  const close = () => {
    ws.close();
    proc.kill();
  };
  return { evaluate, waitFor, key, shot, close, errors };
}

const heroVideo = `document.querySelector('#hero-title').closest('section').querySelector('video')`;
const noOverflow = `document.documentElement.scrollWidth <= document.documentElement.clientWidth`;
const scrollTo = (sel) => `document.querySelector('${sel}').scrollIntoView({block:'start'}); true`;

// ---------- 3. Desktop ----------
{
  const s = await session({ width: 1440, height: 900 });
  const tag = "desktop";
  const heroPlays = await s.waitFor(`!${heroVideo}.paused && ${heroVideo}.currentTime >= 6`); // loop skips MVP's black open
  check(`${tag}: hero is MVP and autoplays muted`,
    heroPlays && (await s.evaluate(`${heroVideo}.currentSrc === '${MEDIA}/mvp/sd.mp4' && ${heroVideo}.muted`)),
    await s.evaluate(`${heroVideo}.currentSrc + ' t=' + ${heroVideo}.currentTime.toFixed(2)`));
  const tc1 = await s.evaluate(`document.querySelector('#hero-title').closest('section').querySelector('.tabular-nums').textContent`);
  await sleep(700);
  const tc2 = await s.evaluate(`document.querySelector('#hero-title').closest('section').querySelector('.tabular-nums').textContent`);
  check(`${tag}: hero timecode advances`, tc1 !== tc2 && tc2 !== "00:00:00:00", `${tc1} → ${tc2}`);
  check(`${tag}: hero wordmark fits`, await s.evaluate(`(() => { const h = document.getElementById('hero-title'); return h.scrollWidth <= h.clientWidth + 1; })()`));
  check(`${tag}: no horizontal overflow`, await s.evaluate(noOverflow));
  await s.evaluate(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Background film sound').click()`);
  check(`${tag}: hero sound toggle unmutes`, await s.waitFor(`!${heroVideo}.muted && document.querySelector('[aria-label="Background film sound"]').getAttribute('aria-pressed') === 'true'`, 2000));
  await s.evaluate(`document.querySelector('[aria-label="Background film sound"]').click()`);
  await s.shot(`${tag}-hero`);

  const counts = await s.evaluate(`({
    pl: document.querySelectorAll('#product-launch article [data-cursor]').length,
    lf: document.querySelectorAll('#long-form article [data-cursor]').length,
    sf: document.querySelectorAll('#short-form article [data-cursor]').length,
    edl: document.querySelectorAll('#index tbody tr').length })`);
  check(`${tag}: section counts 4/2/7 and index 13`,
    counts.pl === 4 && counts.lf === 2 && counts.sf === 7 && counts.edl === 13, JSON.stringify(counts));

  const anchors = await s.evaluate(`[...document.querySelectorAll('header a[href^="#"], a[href="#work"]')].map(a => [a.getAttribute('href'), !!document.querySelector(a.getAttribute('href'))])`);
  check(`${tag}: all nav anchors resolve`, anchors.every(([, ok]) => ok), anchors.map(([h, ok]) => `${h}${ok ? "" : " MISSING"}`).join(" "));

  for (const id of ["product-launch", "long-form", "short-form", "index"]) {
    await s.evaluate(scrollTo(`#${id}`));
    if (id !== "index") {
      const probe = `(() => { const sec = document.getElementById('${id}');
        const ty = new DOMMatrix(getComputedStyle(sec.querySelector('[data-word]')).transform).m42;
        const clips = [...sec.querySelectorAll('[data-clip-in]')].filter(el => el.getBoundingClientRect().top < innerHeight);
        return { titleOffsetPx: +ty.toFixed(2),
                 clipsVisible: clips.every(el => ['none','inset(0%)'].includes(getComputedStyle(el).clipPath)),
                 previewsPlaying: [...sec.querySelectorAll('article video')].filter(v => !v.paused).length }; })()`;
      await s.waitFor(`(() => { const r = ${probe}; return Math.abs(r.titleOffsetPx) < 0.5 && r.clipsVisible && r.previewsPlaying > 0; })()`, 6000);
      const st = await s.evaluate(probe);
      // Frames delivered in 500ms; headless Chromium can starve rAF, which stalls any animation.
      st.rafPer500ms = await s.evaluate(`new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 500 ? requestAnimationFrame(f) : r(n); }; requestAnimationFrame(f); setTimeout(() => r(n), 1500); })`);
      check(`${tag}: ${id} revealed and previews playing`,
        Math.abs(st.titleOffsetPx) < 0.5 && st.clipsVisible && st.previewsPlaying > 0, JSON.stringify(st));
    } else {
      await sleep(800);
    }
    await s.shot(`${tag}-${id}`);
  }

  await s.evaluate(scrollTo("#short-form"));
  await sleep(400);
  const before = await s.evaluate(`document.querySelector('#short-form [role=region]').scrollLeft`);
  await s.evaluate(`document.querySelector('[aria-label="Scroll filmstrip forward"]').click()`);
  check(`${tag}: filmstrip pages forward`,
    await s.waitFor(`document.querySelector('#short-form [role=region]').scrollLeft > ${before + 100}`, 3000));

  // Every project: open from the index, verify source, sound and dimensions, close with Esc.
  const projectsOnPage = await s.evaluate(`[...document.querySelectorAll('#index tbody button')].map(b => b.getAttribute('aria-label'))`);
  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const m = manifest[item.slug];
    await s.evaluate(`(() => { const b = document.querySelectorAll('#index tbody button')[${i}]; b.focus(); b.click(); return true; })()`);
    const playing = await s.waitFor(`(() => { const v = document.querySelector('dialog.player video'); return v && v.currentTime > 0.6 && v.readyState >= 3; })()`, 12000);
    const st = await s.evaluate(`(() => { const d = document.querySelector('dialog.player'); const v = d.querySelector('video');
      return { open: d.open, title: d.querySelector('#player-title')?.textContent, src: v.currentSrc,
               muted: v.muted, volume: v.volume, w: v.videoWidth, h: v.videoHeight,
               audioBytes: v.webkitAudioDecodedByteCount ?? -1, focused: document.activeElement === v,
               error: !!d.querySelector('[role=alert]') }; })()`);
    const expectHd = Boolean(m.files.hd);
    const expW = expectHd ? m.hd.width : m.width;
    const expH = expectHd ? m.hd.height : m.height;
    const ok = st.open && playing && st.focused && st.title === item.title &&
      st.src === `${MEDIA}/${item.slug}/${expectHd ? "hd" : "sd"}.mp4` &&
      !st.muted && st.volume > 0 && st.audioBytes > 0 && st.w === expW && st.h === expH && !st.error;
    check(`${tag}: plays ${item.slug} with sound`, ok,
      `${st.src.slice(MEDIA.length + 1)} ${st.w}x${st.h} audioBytes=${st.audioBytes} focused=${st.focused}`);
    if (i === 0) await s.shot(`${tag}-player`);
    await s.key("Escape", "Escape", 27);
    const closed = await s.waitFor(`!document.querySelector('dialog.player').open`, 3000);
    const paused = await s.waitFor(`!document.querySelector('dialog.player video') || document.querySelector('dialog.player video').paused`, 3000);
    if (!closed || !paused) check(`${tag}: ${item.slug} closes on Esc and stops`, false);
  }
  check(`${tag}: index lists all titles`, projectsOnPage.length === catalog.length);

  // A frame in each layout opens the right piece.
  for (const id of ["product-launch", "long-form", "short-form"]) {
    const expected = await s.evaluate(`document.querySelector('#${id} article h3').textContent`);
    await s.evaluate(`document.querySelector('#${id} article [data-cursor]').click()`);
    await s.waitFor(`document.querySelector('dialog.player').open && !!document.querySelector('#player-title')`, 3000);
    const got = await s.evaluate(`({ open: document.querySelector('dialog.player').open, title: document.querySelector('#player-title')?.textContent ?? null })`);
    check(`${tag}: ${id} frame opens its own film`, got.open && got.title === expected, `expected ${expected}, got ${JSON.stringify(got)}`);
    await s.key("Escape", "Escape", 27);
    await s.waitFor(`!document.querySelector('dialog.player').open`, 3000);
  }

  // Showreel: opens on MVP, N advances, P goes back, focus returns on close.
  await s.evaluate(scrollTo("#top"));
  await s.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Play showreel')); b.focus(); b.click(); return true; })()`);
  await s.waitFor(`document.querySelector('dialog.player').open`, 3000);
  const t0 = await s.evaluate(`document.querySelector('#player-title').textContent`);
  await s.key("n", "KeyN", 78);
  await sleep(400);
  const t1 = await s.evaluate(`document.querySelector('#player-title').textContent`);
  await s.key("p", "KeyP", 80);
  await sleep(400);
  const t2 = await s.evaluate(`document.querySelector('#player-title').textContent`);
  check(`${tag}: showreel starts on MVP, N/P navigate`, t0 === "MVP" && t1 !== t0 && t2 === t0, `${t0} → ${t1} → ${t2}`);
  await s.key("Escape", "Escape", 27);
  await s.waitFor(`!document.querySelector('dialog.player').open`, 3000);
  check(`${tag}: focus returns to trigger`, await s.evaluate(`document.activeElement?.textContent.includes('Play showreel')`));

  check(`${tag}: no console errors`, s.errors.length === 0, s.errors.slice(0, 3).join(" | "));
  s.close();
}

// ---------- 4. Mobile ----------
{
  const s = await session({ width: 390, height: 844 });
  const tag = "mobile";
  check(`${tag}: hero plays`, await s.waitFor(`!${heroVideo}.paused`));
  check(`${tag}: no horizontal overflow`, await s.evaluate(noOverflow));
  await sleep(2000); // let the intro finish before the screenshot
  await s.shot(`${tag}-hero`);
  for (const id of ["product-launch", "long-form", "short-form", "index"]) {
    await s.evaluate(scrollTo(`#${id}`));
    await sleep(1600);
    await s.shot(`${tag}-${id}`);
  }
  check(`${tag}: no horizontal overflow after scroll`, await s.evaluate(noOverflow));
  const trailer = catalog.findIndex((c) => c.slug === "tedx-trailer");
  await s.evaluate(`document.querySelectorAll('#index tbody button')[${trailer}].click()`);
  await s.waitFor(`document.querySelector('dialog.player video')?.currentSrc`, 5000);
  const src = await s.evaluate(`document.querySelector('dialog.player video').currentSrc`);
  check(`${tag}: player serves SD, not HD`, src === `${MEDIA}/tedx-trailer/sd.mp4`, src);
  await sleep(1500); // let the cut-in transition finish
  await s.shot(`${tag}-player`);
  check(`${tag}: no console errors`, s.errors.length === 0, s.errors.slice(0, 3).join(" | "));
  s.close();
}

// ---------- 5. Reduced motion ----------
{
  const s = await session({ width: 1440, height: 900, reducedMotion: true });
  const tag = "reduced-motion";
  await sleep(2500);
  const st = await s.evaluate(`({ heroPaused: ${heroVideo}.paused,
    previewVideos: document.querySelectorAll('article [data-cursor] video').length,
    letter: getComputedStyle(document.querySelector('[data-hero-letter]')).transform,
    posterShown: document.querySelector('#hero-title').closest('section').querySelector('img').naturalWidth > 0 })`);
  check(`${tag}: no autoplay, no preview loops, poster shown, no transforms`,
    st.heroPaused && st.previewVideos === 0 && st.posterShown && st.letter === "none", JSON.stringify(st));
  await s.evaluate(`document.querySelector('[aria-label="Play background film"]').click()`);
  check(`${tag}: manual hero play works`, await s.waitFor(`!${heroVideo}.paused`, 4000));
  await s.shot(`${tag}-hero`);
  s.close();
}

// ---------- 6. Video failure ----------
{
  const s = await session({ width: 1440, height: 900, blockVideo: true });
  const tag = "video-blocked";
  await sleep(2500);
  const st = await s.evaluate(`(() => { const sec = document.querySelector('#hero-title').closest('section');
    return { posterShown: sec.querySelector('img').naturalWidth > 0,
             videoHidden: getComputedStyle(sec.querySelector('video')).opacity === '0',
             status: sec.textContent.includes('Offline') }; })()`);
  check(`${tag}: hero falls back to poster`, st.posterShown && st.videoHidden && st.status, JSON.stringify(st));
  await s.shot(`${tag}-hero`);
  await s.evaluate(`document.querySelectorAll('#index tbody button')[1].click()`);
  check(`${tag}: player shows error state with retry`,
    await s.waitFor(`!!document.querySelector('dialog.player [role=alert]')`, 6000));
  await s.shot(`${tag}-player`);
  s.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);

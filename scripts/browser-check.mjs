#!/usr/bin/env node
// End-to-end checks against a running build, via the Chrome DevTools Protocol
// (no dependencies; drives a locally installed Edge or Chrome).
//
// Usage: node scripts/browser-check.mjs [--url http://localhost:3100] [--media <base>] [--out ./qa] [--loose-media]
//   --media: the NEXT_PUBLIC_MEDIA_BASE_URL the site was built with (default <url>/media)
//   --loose-media: skip byte-size checks against the manifest (for stand-in test media)
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
const OUT = resolve(arg("--out", join(tmpdir(), "portfolio-qa")));
const LOOSE = process.argv.includes("--loose-media");
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
    check(`asset ${slug}/${file}`,
      res.status === 206 && (LOOSE || total === m.bytes[key]) && /^(video\/mp4|image\/jpeg)/.test(type),
      `status ${res.status}, ${total} bytes, ${type}`);
  }
}

// ---------- 1b. Branding and headers ----------
{
  const res = await fetch(BASE);
  const html = await res.text();
  check("branding: tab title", html.includes("<title>Abhishek Pandey — Video Editor</title>"));
  check("branding: og + twitter image linked",
    /<meta property="og:image" content="[^"]*\/opengraph-image/.test(html) && html.includes('content="summary_large_image"'));
  check("branding: no Basiumlabs studio identity", !/basiumlabs|video editing studio/i.test(html));
  check("branding: name is the h1", /<h1[^>]*>Abhishek Pandey/.test(html));
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
  check("media: page references configured media base", html.includes(`${mediaRef}/mvp/`), mediaRef);
  for (const path of ["/icon.svg", "/opengraph-image"]) {
    const r = await fetch(BASE + path);
    check(`branding: ${path} served`, r.ok, `${r.status} ${r.headers.get("content-type")}`);
  }
  const nf = await fetch(`${BASE}/definitely-not-a-page`);
  const nfHtml = await nf.text();
  check("branding: 404 page is branded",
    nf.status === 404 && nfHtml.includes("<title>Page not found — Abhishek Pandey</title>"), `status ${nf.status}`);
}

// ---------- 2. Browser session helpers ----------
async function session({ width, height, reducedMotion = false, blockVideo = false }) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = mkdtempSync(join(tmpdir(), "pf-cdp-"));
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
  const shot = async (name, { full = false } = {}) => {
    let params = { format: "png" };
    if (full) {
      const { cssContentSize: c } = (await send("Page.getLayoutMetrics")).result;
      params = { ...params, captureBeyondViewport: true, clip: { x: 0, y: 0, width: c.width, height: c.height, scale: 1 } };
    }
    const r = await send("Page.captureScreenshot", params);
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
const heroTitle = `document.querySelector('#hero-title').textContent`;
const noOverflow = `document.documentElement.scrollWidth <= document.documentElement.clientWidth`;
const scrollTo = (sel) => `document.querySelector('${sel}').scrollIntoView({block:'start'}); true`;
const clickText = (sel, text) =>
  `(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)})); b.focus(); b.click(); return true; })()`;
const playerOpen = `document.querySelector('dialog.player').open`;
const playerTitle = `document.querySelector('#player-title')?.textContent`;
// Collapsed, the grid hides items past its full rows with CSS; count what's shown.
const counts = `({ grid: [...document.querySelectorAll('#work-grid > li')].filter(li => li.getClientRects().length).length,
  label: document.querySelector('#work-title span').textContent,
  reels: document.querySelectorAll('#reels li').length,
  index: document.querySelectorAll('#index li').length })`;

// ---------- 3. Desktop ----------
{
  const s = await session({ width: 1440, height: 900 });
  const tag = "desktop";
  const heroPlays = await s.waitFor(`!${heroVideo}.paused && ${heroVideo}.currentTime >= 6`); // intro loop skips MVP's black open
  check(`${tag}: intro slide loops MVP muted from 6s`,
    heroPlays && (await s.evaluate(`${heroVideo}.currentSrc === '${MEDIA}/mvp/sd.mp4' && ${heroVideo}.muted`)),
    await s.evaluate(`${heroVideo}.currentSrc + ' t=' + ${heroVideo}.currentTime.toFixed(2)`));
  check(`${tag}: no horizontal overflow`, await s.evaluate(noOverflow));
  check(`${tag}: side rail visible`, await s.evaluate(`getComputedStyle(document.querySelector('nav[aria-label=Sections]')).display !== 'none'`));
  await sleep(900);
  await s.shot(`${tag}-home`);

  const c0 = await s.evaluate(counts);
  check(`${tag}: default counts (4 cards, 7 reels, 13 in index)`,
    c0.grid === 4 && c0.reels === 7 && c0.index === 13 && c0.label.endsWith("13"), JSON.stringify(c0));
  await s.evaluate(clickText("nav[aria-label='Filter work'] button", "Short Form"));
  await s.evaluate(clickText("#work button", "See all"));
  const c1 = await s.evaluate(counts);
  check(`${tag}: Short Form filter + See all shows 7`, c1.grid === 7 && c1.label.endsWith("7"), JSON.stringify(c1));
  await s.evaluate(clickText("nav[aria-label='Filter work'] button", "Product Films"));
  const c2 = await s.evaluate(counts);
  check(`${tag}: Product Films filter shows 4, collapsed`, c2.grid === 4 && c2.label.endsWith("4"), JSON.stringify(c2));
  await s.evaluate(clickText("nav[aria-label='Filter work'] button", "All work"));

  // Focus a card: the preview loop attaches and plays.
  await s.evaluate(`document.querySelector('#work-grid button').focus(); true`);
  check(`${tag}: card preview plays on focus`,
    await s.waitFor(`(() => { const v = document.querySelector('#work-grid video'); return v && !v.paused && v.currentTime > 0.2; })()`, 6000));

  const anchors = await s.evaluate(`[...document.querySelectorAll('a[href^="#"]')].map(a => [a.getAttribute('href'), !!document.querySelector(a.getAttribute('href'))])`);
  check(`${tag}: all in-page anchors resolve`, anchors.every(([, ok]) => ok), anchors.filter(([, ok]) => !ok).map(([h]) => h).join(" "));

  // Carousel: next shows the first featured piece and plays its preview; Watch opens it.
  await s.evaluate(`document.querySelector('[aria-label="Next slide"]').click()`);
  await s.waitFor(`${heroTitle} === 'TEDx Trailer'`, 3000);
  check(`${tag}: carousel next → TEDx Trailer preview`,
    await s.waitFor(`${heroVideo}.currentSrc === '${MEDIA}/tedx-trailer/preview.mp4' && !${heroVideo}.paused`, 6000),
    await s.evaluate(`${heroTitle} + ' ' + ${heroVideo}.currentSrc`));
  check(`${tag}: h1 keeps the name on featured slides`, await s.evaluate(`document.querySelector('h1').textContent.startsWith('Abhishek Pandey')`));
  await sleep(900);
  await s.shot(`${tag}-featured`);
  await s.evaluate(clickText("section[aria-roledescription] button", "Watch"));
  await s.waitFor(playerOpen, 3000);
  check(`${tag}: Watch opens the featured film`, (await s.evaluate(playerTitle)) === "TEDx Trailer");
  await s.key("Escape", "Escape", 27);
  await s.waitFor(`!${playerOpen}`, 3000);
  await s.evaluate(`document.querySelector('[aria-label="Previous slide"]').click()`);

  // Every project from the index: right source (HD on desktop when available), sound, focus; Esc closes.
  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const m = manifest[item.slug];
    await s.evaluate(`(() => { const b = document.querySelectorAll('#index li button')[${i}]; b.focus(); b.click(); return true; })()`);
    const playing = await s.waitFor(`(() => { const v = document.querySelector('dialog.player video'); return v && v.currentTime > 0.6 && v.readyState >= 3; })()`, 12000);
    const st = await s.evaluate(`(() => { const d = document.querySelector('dialog.player'); const v = d.querySelector('video');
      return { open: d.open, title: d.querySelector('#player-title')?.textContent, src: v.currentSrc,
               muted: v.muted, w: v.videoWidth, h: v.videoHeight,
               audioBytes: v.webkitAudioDecodedByteCount ?? -1, focused: document.activeElement === v,
               error: !!d.querySelector('[role=alert]') }; })()`);
    const expectHd = Boolean(m.files.hd);
    const ok = st.open && playing && st.focused && st.title === item.title &&
      st.src === `${MEDIA}/${item.slug}/${expectHd ? "hd" : "sd"}.mp4` && !st.muted && st.audioBytes > 0 &&
      st.w === (expectHd ? m.hd.width : m.width) && st.h === (expectHd ? m.hd.height : m.height) && !st.error;
    check(`${tag}: plays ${item.slug} with sound`, ok,
      `${st.src.slice(MEDIA.length + 1)} ${st.w}x${st.h} audioBytes=${st.audioBytes} focused=${st.focused}`);
    if (i === 0) await s.shot(`${tag}-player`);
    await s.key("Escape", "Escape", 27);
    const closed = await s.waitFor(`!${playerOpen}`, 3000);
    const paused = await s.waitFor(`!document.querySelector('dialog.player video') || document.querySelector('dialog.player video').paused`, 3000);
    if (!closed || !paused) check(`${tag}: ${item.slug} closes on Esc and stops`, false);
  }

  // A reel tile opens that reel.
  const reelLabel = await s.evaluate(`document.querySelector('#reels li button').getAttribute('aria-label')`);
  await s.evaluate(`document.querySelector('#reels li button').click()`);
  await s.waitFor(playerOpen, 3000);
  const gotReel = await s.evaluate(playerTitle);
  check(`${tag}: reel tile opens its own film`, reelLabel.startsWith(`Play ${gotReel},`), `${reelLabel} → ${gotReel}`);
  await s.key("Escape", "Escape", 27);
  await s.waitFor(`!${playerOpen}`, 3000);

  // Showreel: opens on MVP, N advances, P goes back, focus returns on close.
  await s.evaluate(scrollTo("#top"));
  await s.evaluate(clickText("button", "Play showreel"));
  await s.waitFor(playerOpen, 3000);
  const t0 = await s.evaluate(playerTitle);
  await s.key("n", "KeyN", 78);
  await sleep(400);
  const t1 = await s.evaluate(playerTitle);
  await s.key("p", "KeyP", 80);
  await sleep(400);
  const t2 = await s.evaluate(playerTitle);
  check(`${tag}: showreel starts on MVP, N/P navigate`, t0 === "MVP" && t1 !== t0 && t2 === t0, `${t0} → ${t1} → ${t2}`);
  await s.key("Escape", "Escape", 27);
  await s.waitFor(`!${playerOpen}`, 3000);
  check(`${tag}: focus returns to trigger`, await s.evaluate(`document.activeElement?.textContent.includes('Play showreel')`));

  for (const id of ["about", "contact"]) {
    await s.evaluate(scrollTo(`#${id}`));
    await sleep(500);
    await s.shot(`${tag}-${id}`);
  }
  check(`${tag}: no console errors`, s.errors.length === 0, s.errors.slice(0, 3).join(" | "));
  s.close();
}

// ---------- 4. Mobile ----------
{
  const s = await session({ width: 390, height: 844 });
  const tag = "mobile";
  check(`${tag}: hero plays`, await s.waitFor(`!${heroVideo}.paused`));
  check(`${tag}: no horizontal overflow`, await s.evaluate(noOverflow));
  check(`${tag}: side rail hidden`, await s.evaluate(`getComputedStyle(document.querySelector('nav[aria-label=Sections]')).display === 'none'`));
  await sleep(1200);
  await s.shot(`${tag}-home`);
  for (const id of ["work", "reels", "index", "about", "contact"]) {
    await s.evaluate(scrollTo(`#${id}`));
    await sleep(700);
    await s.shot(`${tag}-${id}`);
  }
  check(`${tag}: no horizontal overflow after scroll`, await s.evaluate(noOverflow));
  const trailer = catalog.findIndex((c) => c.slug === "tedx-trailer");
  await s.evaluate(`document.querySelectorAll('#index li button')[${trailer}].click()`);
  await s.waitFor(`document.querySelector('dialog.player video')?.currentSrc`, 5000);
  const src = await s.evaluate(`document.querySelector('dialog.player video').currentSrc`);
  check(`${tag}: player serves SD, not HD`, src === `${MEDIA}/tedx-trailer/sd.mp4`, src);
  await sleep(1000);
  await s.shot(`${tag}-player`);
  check(`${tag}: no console errors`, s.errors.length === 0, s.errors.slice(0, 3).join(" | "));
  s.close();
}

// ---------- 5. Reduced motion ----------
{
  const s = await session({ width: 1440, height: 900, reducedMotion: true });
  const tag = "reduced-motion";
  await sleep(2500);
  await s.evaluate(`document.querySelector('#work-grid button').focus(); true`);
  await sleep(800);
  const st = await s.evaluate(`({ heroPaused: ${heroVideo}.paused,
    previewVideos: document.querySelectorAll('#work-grid video').length,
    posterShown: document.querySelector('#hero-title').closest('section').querySelector('img').naturalWidth > 0 })`);
  check(`${tag}: no autoplay, no hover previews, poster shown`,
    st.heroPaused && st.previewVideos === 0 && st.posterShown, JSON.stringify(st));
  await s.evaluate(`document.querySelector('[aria-label="Play background video"]').click()`);
  check(`${tag}: manual hero play works`, await s.waitFor(`!${heroVideo}.paused`, 4000));
  s.close();
}

// ---------- 6. Video failure ----------
{
  const s = await session({ width: 1440, height: 900, blockVideo: true });
  const tag = "video-blocked";
  await sleep(2500);
  const st = await s.evaluate(`(() => { const sec = document.querySelector('#hero-title').closest('section');
    return { posterShown: sec.querySelector('img').naturalWidth > 0,
             videoHidden: getComputedStyle(sec.querySelector('video')).opacity === '0' }; })()`);
  check(`${tag}: hero falls back to poster`, st.posterShown && st.videoHidden, JSON.stringify(st));
  await s.evaluate(`document.querySelectorAll('#index li button')[1].click()`);
  check(`${tag}: player shows error state with retry`,
    await s.waitFor(`!!document.querySelector('dialog.player [role=alert]')`, 6000));
  await s.shot(`${tag}-player`);
  s.close();
}

// ---------- 7. Responsive sweep ----------
// Whole page at each width: overflow, window width, section alignment, rail
// clearance, nav wrapping, full card rows, tap targets, and real playback of one
// horizontal and one vertical film with the player box matching the film's ratio.
const VIEWPORTS = [
  [1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1024, 768],
  [768, 1024], [390, 844], [375, 667], [320, 568],
];
const expectedCards = (w) => (w >= 1536 ? 5 : w >= 1024 ? 4 : w >= 768 ? 6 : 4);
const gridCols = (w) => (w >= 1536 ? 5 : w >= 1024 ? 4 : w >= 768 ? 3 : 2);

for (const [width, height] of VIEWPORTS) {
  const s = await session({ width, height });
  const tag = `${width}px`;
  await s.waitFor(`!!document.querySelector('#hero-title')`, 8000);
  await sleep(800);

  // Walk down the page so lazy content renders, then measure.
  await s.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight); true`);
  await sleep(300);
  await s.evaluate(`window.scrollTo(0, 0); true`);
  await sleep(300);

  const m = await s.evaluate(`(() => {
    const vw = document.documentElement.clientWidth;
    const r = (el) => el.getBoundingClientRect();
    const win = document.querySelector('#top > div');
    const about = document.getElementById('about'), contact = document.getElementById('contact');
    const rail = document.querySelector('nav[aria-label=Sections]');
    const railShown = getComputedStyle(rail).display !== 'none';
    const nav = document.querySelector('nav[aria-label="Filter work"]');
    // Anything poking past the viewport, ignoring sr-only text, the closed dialog,
    // and content an ancestor clips to its own (in-viewport) box.
    const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX; if (o !== 'visible') { const b = r(a); return b.right <= vw + 1 && b.left >= -1; } } return false; };
    const offenders = [...document.querySelectorAll('body *')].filter(el => {
      if (el.closest('dialog') || el.closest('.sr-only') || !el.getClientRects().length) return false;
      const b = r(el); return b.width > 0 && (b.right > vw + 1 || b.left < -1) && !clipped(el);
    }).slice(0, 5).map(el => el.tagName + '.' + String(el.className).split(' ').slice(0, 3).join('.'));
    const tabs = [...nav.querySelectorAll('button, a')].map(r);
    const index = [...document.querySelectorAll('#index li button')];
    return {
      vw,
      overflow: document.documentElement.scrollWidth > vw,
      offenders,
      winRatio: +(r(win).width / vw).toFixed(3),
      leftGap: Math.round(r(win).left), rightGap: Math.round(vw - r(win).right),
      aligned: [about, contact].every(el => Math.abs(r(el).left - r(win).left) <= 1 && Math.abs(r(el).right - r(win).right) <= 1),
      railShown,
      railClear: !railShown || r(rail).right <= r(win).left - 4,
      navNoScroll: nav.scrollWidth <= nav.clientWidth + 1 && tabs.every(b => b.right <= vw && b.left >= 0),
      tabMinH: Math.round(Math.min(...tabs.map(b => b.height))),
      h1Fits: (() => { const h = document.querySelector('h1'); return h.scrollWidth <= h.clientWidth + 1; })(),
      cards: [...document.querySelectorAll('#work-grid > li')].filter(li => li.getClientRects().length).length,
      cardRowTops: [...new Set([...document.querySelectorAll('#work-grid > li')].filter(li => li.getClientRects().length).map(li => Math.round(r(li).top)))].length,
      reels: document.querySelectorAll('#reels li').length,
      indexCount: index.length,
      indexMinH: Math.round(Math.min(...index.map(b => r(b).height))),
      cardsUndistorted: [...document.querySelectorAll('#work-grid img, #reels img, #index img')].every(i => getComputedStyle(i).objectFit === 'cover'),
    };
  })()`);

  check(`${tag}: no horizontal overflow (whole page)`, !m.overflow && m.offenders.length === 0, m.offenders.join(", "));
  if (width >= 1024) {
    check(`${tag}: window uses ≥ 91% of the viewport`, m.winRatio >= 0.91, `${(m.winRatio * 100).toFixed(1)}%, gaps L${m.leftGap}/R${m.rightGap}px`);
  } else {
    check(`${tag}: window fills the width (≤ 16px gutters)`, m.leftGap <= 16 && m.rightGap <= 16, `gaps L${m.leftGap}/R${m.rightGap}px`);
  }
  check(`${tag}: About + Contact align with the window`, m.aligned);
  check(`${tag}: rail ${width >= 1280 ? "shown and clear of the window" : "hidden"}`, width >= 1280 ? m.railShown && m.railClear : !m.railShown);
  check(`${tag}: filter tabs fit without horizontal scrolling`, m.navNoScroll && m.tabMinH >= 32, `min tab height ${m.tabMinH}px`);
  check(`${tag}: name not clipped`, m.h1Fits);
  check(`${tag}: ${expectedCards(width)} cards in full rows of ${gridCols(width)}`,
    m.cards === expectedCards(width) && m.cardRowTops === m.cards / gridCols(width), `${m.cards} cards, ${m.cardRowTops} rows`);
  check(`${tag}: 7 reels and all 13 edits listed, tap targets ≥ 44px`,
    m.reels === 7 && m.indexCount === 13 && m.indexMinH >= 44, `reels ${m.reels}, index ${m.indexCount}, min row ${m.indexMinH}px`);
  check(`${tag}: thumbnails crop (object-fit: cover), never stretch`, m.cardsUndistorted);
  await s.shot(`sweep-${width}-top`);
  await s.shot(`sweep-${width}-full`, { full: true });

  // Real playback: one 16:9 and one 9:16 film. The player box must match the
  // film's ratio and sit fully on screen with its controls.
  for (const slug of ["tedx-end-of-story", "facultify"]) {
    const i = catalog.findIndex((c) => c.slug === slug);
    await s.evaluate(`(() => { const b = document.querySelectorAll('#index li button')[${i}]; b.scrollIntoView({block:'center'}); b.click(); return true; })()`);
    const playing = await s.waitFor(`(() => { const v = document.querySelector('dialog.player video'); return v && v.currentTime > 0.5 && v.readyState >= 3; })()`, 15000);
    const p = await s.evaluate(`(() => { const d = document.querySelector('dialog.player'); const v = d.querySelector('video');
      const b = v.getBoundingClientRect(); const close = [...d.querySelectorAll('button')].find(x => x.textContent.includes('Close')).getBoundingClientRect();
      return { title: d.querySelector('#player-title').textContent, src: v.currentSrc.split('/').slice(-2).join('/'),
        boxRatio: b.width / b.height, filmRatio: v.videoWidth / v.videoHeight,
        onScreen: b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1,
        closeOnScreen: close.right <= innerWidth && close.top >= 0, w: Math.round(b.width), h: Math.round(b.height) }; })()`);
    check(`${tag}: plays ${slug} at its own ratio, on screen`,
      playing && p.title === catalog[i].title && Math.abs(p.boxRatio - p.filmRatio) < 0.02 && p.onScreen && p.closeOnScreen,
      `${p.src} box ${p.w}x${p.h} (${p.boxRatio.toFixed(3)} vs film ${p.filmRatio.toFixed(3)})`);
    if (slug === "facultify") await s.shot(`sweep-${width}-player-vertical`);
    await s.key("Escape", "Escape", 27);
    await s.waitFor(`!${playerOpen}`, 3000);
  }
  check(`${tag}: no console errors`, s.errors.length === 0, s.errors.slice(0, 3).join(" | "));
  s.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);

# Deploying the portfolio

The site deploys to **Vercel** from GitHub. Video and poster files are **not** in the repo or the deployment; they are served from a **Cloudflare R2** bucket.

## How media URLs work

`src/lib/media.ts` builds every media URL as

```
${NEXT_PUBLIC_MEDIA_BASE_URL}/<slug>/<file>      e.g. https://media.example.com/tedx-trailer/hd.mp4
```

- The variable is inlined into the client bundle **at build time**. Changing it requires a redeploy.
- It is a public URL, not a secret. No storage credentials are used by the site.
- Unset locally → `/media` (served from `public/media`). On Vercel the build **fails on purpose** if it is unset, or if it is not an `https://` URL.

**Files to upload: 45 (≈ 346 MB)**, exactly the entries in `src/content/media-manifest.json`: for each of the 13 slugs `sd.mp4`, `preview.mp4`, `poster.jpg`, plus `hd.mp4` for the 6 slugs that have one. Bucket keys mirror `public/media/`: `<slug>/<file>`. Other files in `public/media/` (the flat `*.mp4`/`*.jpg` from the early prototype) are unused and need not be uploaded.

## Costs and decisions (yours to make)

- **Cloudflare R2**: free tier covers this size (10 GB-month storage, no egress fees). Cloudflare asks for a payment method before R2 can be enabled.
- **Vercel**: the Hobby plan is for non-commercial use. A portfolio used to win client work may need the paid Pro plan; check Vercel's current terms.
- **Domain**: production media should use a custom domain on Cloudflare (below). Without one, the `r2.dev` URL works for testing only (it is rate-limited).

## 1. Cloudflare R2

1. Cloudflare dashboard → **R2 Object Storage** → enable R2 → **Create bucket**, name `portfolio-media`, location *Automatic*.
2. Public access — choose one:
   - **Production:** bucket → **Settings → Custom Domains → Connect Domain** → e.g. `media.yourdomain.com` (the domain's DNS must be on Cloudflare). Base URL: `https://media.yourdomain.com`
   - **Testing only:** bucket → **Settings → Public Development URL → Enable**. Base URL: the shown `https://pub-….r2.dev`
3. Upload from this folder (auth is stored by Wrangler in your user profile, never in the project):

   ```bash
   npx wrangler login
   npm run media:upload -- portfolio-media          # dry run: lists all 45 files, validates sizes
   npm run media:upload -- portfolio-media --yes    # uploads (Content-Type + Cache-Control: 7 days)
   ```

4. Check one file: `curl -I https://media.yourdomain.com/mvp/sd.mp4` → `200`, `content-type: video/mp4`.

**CORS: not required.** The site loads media with plain `<video>`/`<img>` (no `crossorigin` attribute, no `fetch`), which browsers allow cross-origin without CORS; this was verified with a CORS-less host. Only if you later add `crossorigin`, canvas capture or `fetch()` of media, add under bucket **Settings → CORS policy**:

```json
[{ "AllowedOrigins": ["https://yourdomain.com"], "AllowedMethods": ["GET", "HEAD"],
   "AllowedHeaders": ["Range"], "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"], "MaxAgeSeconds": 3600 }]
```

## 2. GitHub

```bash
git status                      # public/media must NOT appear (it is git-ignored)
git add -A
git commit -m "Prepare portfolio for production"
# create an empty private repo on GitHub, then:
git remote add origin https://github.com/<you>/portfolio.git
git push -u origin main
```

## 3. Vercel

1. **Add New → Project → Import** the GitHub repo. Framework preset: Next.js (auto). Root directory: the repo root. Build settings: defaults.
2. **Environment Variables** → `NEXT_PUBLIC_MEDIA_BASE_URL` = your base URL from step 1.2 (no trailing slash needed), for **Production** and **Preview**.
3. Optional: `NEXT_PUBLIC_SITE_URL` = the public site URL (custom domain), for absolute link-preview image URLs.
4. **Deploy.** If the variable is missing the build stops with a clear error.
5. Verify against the live site (needs Edge or Chrome locally):

   ```bash
   npm run check:browser -- --url https://<your-site>.vercel.app --media https://media.yourdomain.com
   ```

## Updating media later

`npm run media:encode -- --force <slug>` → `npm run media:upload -- portfolio-media --yes` → if served through a custom domain, purge those URLs (Cloudflare → **Caching → Purge Cache**) → commit the updated `media-manifest.json` and push (Vercel redeploys).

## Secrets

- The repo contains no credentials. `.env*` files are git-ignored (except `.env.example`).
- Never put R2 access keys in any `NEXT_PUBLIC_*` variable; those are shipped to browsers.
- Vercel needs no Cloudflare credentials.

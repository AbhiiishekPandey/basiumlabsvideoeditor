import type { NextConfig } from "next";

// Media (public/media) is git-ignored, so a Vercel build without an external
// media host would deploy a site whose videos all 404. Fail the build instead.
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
if (process.env.VERCEL && !mediaBase) {
  throw new Error(
    "NEXT_PUBLIC_MEDIA_BASE_URL is not set. public/media is not deployed; set it to the public URL of the media bucket (see DEPLOYMENT.md).",
  );
}
if (mediaBase && !/^(https:\/\/[^/\s]+|http:\/\/localhost(:\d+)?|\/)\S*$/.test(mediaBase)) {
  throw new Error(`NEXT_PUBLIC_MEDIA_BASE_URL must be an https:// URL or a root-relative path, got "${mediaBase}".`);
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // No framework branding: drop the X-Powered-By header and the dev-mode badge.
  poweredByHeader: false,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import { mediaUrl } from "@/lib/media";
import catalog from "./catalog.json";
import manifest from "./media-manifest.json";

export type CategoryId = "product-launch" | "long-form" | "short-form";

export type Category = {
  id: CategoryId;
  index: string;
  title: string;
  summary: string;
};

export type Project = {
  slug: string;
  title: string;
  format: string;
  category: CategoryId;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  hasAudio: boolean;
  previewStart: number;
  previewSeconds: number;
  poster: string;
  preview: string;
  /** Full piece, long edge <= 1280. Default and mobile source. */
  src: string;
  /** Full piece, long edge <= 1920, when the source is larger than SD. */
  srcHd?: string;
  sourceFile: string;
  sourceFolder: string;
};

// Order here is the order on the page.
export const categories: Category[] = [
  {
    id: "product-launch",
    index: "01",
    title: "Product Launch",
    summary: "Cinematic product films, UI walkthroughs and launch campaigns.",
  },
  {
    id: "long-form",
    index: "02",
    title: "Long Form",
    summary: "Trailers and documentary storytelling, paced for the full watch.",
  },
  {
    id: "short-form",
    index: "03",
    title: "Short Form",
    summary: "Reels, teasers, event promos and caption-led social edits.",
  },
];

type ManifestEntry = (typeof manifest)[keyof typeof manifest] & {
  files: { hd?: string };
};

// Editorial data comes from catalog.json; every measurement (size, duration,
// fps, audio) comes from media-manifest.json, written by
// scripts/encode-media.mjs from the actual encoded files. A project only
// appears once its media has been built.
export const projects: Project[] = catalog.projects.flatMap((item) => {
  const m = (manifest as Record<string, ManifestEntry>)[item.slug];
  if (!m) return [];
  const file = (name: string) => mediaUrl(`${item.slug}/${name}`);
  return [
    {
      slug: item.slug,
      title: item.title,
      format: item.format,
      category: item.category as CategoryId,
      width: m.width,
      height: m.height,
      fps: m.fps,
      durationSeconds: m.duration,
      hasAudio: m.hasAudio,
      previewStart: m.previewStart,
      previewSeconds: m.previewDuration,
      poster: file(m.files.poster),
      preview: file(m.files.preview),
      src: file(m.files.sd),
      srcHd: m.files.hd ? file(m.files.hd) : undefined,
      sourceFile: m.source.file,
      sourceFolder: m.source.folder,
    },
  ];
});

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);

export const heroProject = projectBySlug("mvp") ?? projects[0];

export const projectsIn = (id: CategoryId) => projects.filter((p) => p.category === id);

export const isVertical = (p: Project) => p.height > p.width;

export const aspectLabel = (p: Project) => {
  const r = p.width / p.height;
  if (Math.abs(r - 16 / 9) < 0.02) return "16:9";
  if (Math.abs(r - 9 / 16) < 0.02) return "9:16";
  return `${p.width}×${p.height}`;
};

export const totalRuntime = (list: Project[]) =>
  list.reduce((sum, p) => sum + p.durationSeconds, 0);

// The showreel plays every piece back to back, opening on the hero film.
// There is no separate showreel cut, so this is the honest equivalent.
const REEL_ORDER = [
  "mvp",
  "tedx-trailer",
  "robomania",
  "brandpilot",
  "tedx-end-of-story",
  "basium-ai",
  "student-life",
  "something-new-is-coming",
  "tedx-beginning",
  "facultify",
  "basium-in-launch",
  "tedx-registration",
  "basium-in-reel",
];

export const showreel: Project[] = [
  ...REEL_ORDER.flatMap((slug) => projectBySlug(slug) ?? []),
  ...projects.filter((p) => !REEL_ORDER.includes(p.slug)),
];

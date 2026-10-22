import { Chapter } from "@/components/chapter";
import { CursorTag } from "@/components/cursor-tag";
import { EditDecisionList } from "@/components/edit-decision-list";
import { Hero } from "@/components/hero";
import { PlayerProvider } from "@/components/player";
import { ScrollPlayhead } from "@/components/scroll-playhead";
import { SiteHeader } from "@/components/site-header";
import { categories, heroProject, projects, projectsIn, totalRuntime } from "@/content/projects";
import { toTimecode } from "@/lib/timecode";

export default function Home() {
  return (
    <PlayerProvider>
      <a
        href="#work"
        className="sr-only z-[80] bg-bone px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to work
      </a>
      <div aria-hidden="true" className="grain" />
      <ScrollPlayhead />
      <SiteHeader />
      <CursorTag />

      <main id="top">
        <Hero project={heroProject} />
        <div id="work" className="scroll-mt-16">
          {categories.map((c) => {
            const list = projectsIn(c.id);
            return list.length ? <Chapter key={c.id} category={c} projects={list} /> : null;
          })}
        </div>
        <EditDecisionList projects={projects} />
      </main>

      <footer className="overflow-hidden border-t border-line px-4 pt-10 pb-6 sm:px-8">
        <div className="flex flex-col gap-2 font-mono text-[11px] tracking-[0.15em] text-bone-dim uppercase sm:flex-row sm:justify-between sm:text-xs">
          <p>© Basiumlabs · Video editing studio</p>
          <p className="tabular-nums">
            {projects.length} films · TRT {toTimecode(totalRuntime(projects))}
          </p>
          <a href="#top" className="text-bone hover:text-rec">
            Back to top ↑
          </a>
        </div>
        <p aria-hidden="true" className="mt-8 font-display text-[calc((100vw-2rem)/4.7)] leading-[0.8] text-line uppercase select-none sm:text-[calc((100vw-4rem)/4.7)]">
          Basiumlabs
        </p>
      </footer>
    </PlayerProvider>
  );
}

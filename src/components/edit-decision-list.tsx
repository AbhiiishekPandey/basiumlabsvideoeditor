"use client";

import { categories, totalRuntime, type Project } from "@/content/projects";
import { toRuntime, toSpokenRuntime, toTimecode } from "@/lib/timecode";
import { usePlayer } from "./player";

// The full index, styled as an edit decision list: every piece laid end to end
// on one record timeline, with real source filenames and running timecode.
export function EditDecisionList({ projects }: { projects: Project[] }) {
  const { openPlayer } = usePlayer();
  const rows = projects.map((p, i) => {
    const recIn = totalRuntime(projects.slice(0, i));
    return { p, recIn, recOut: recIn + p.durationSeconds };
  });

  return (
    <section id="index" aria-labelledby="index-title" className="scroll-mt-16 px-4 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-28">
      <div className="h-px bg-line" />
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4 sm:mt-8">
        <div>
          <p className="mb-3 font-mono text-[11px] tracking-[0.18em] text-bone-dim uppercase sm:text-xs">
            <span className="text-rec">EDL</span> · {projects.length} events · TRT {toTimecode(totalRuntime(projects))}
          </p>
          <h2 id="index-title" className="font-display text-[clamp(3rem,9vw,8rem)] leading-[0.86] uppercase">
            Index
          </h2>
        </div>
        <button type="button" onClick={() => openPlayer(projects, 0, { label: "Full index" })} className="btn-ghost-lg">
          <span aria-hidden="true" className="text-rec">▶</span> Play all
        </button>
      </header>

      <table className="mt-10 w-full border-collapse font-mono text-[11px] tracking-[0.08em] uppercase sm:text-xs">
        <caption className="sr-only">All {projects.length} films. Select a title to play it.</caption>
        <thead className="text-left text-bone-dim">
          <tr className="border-b border-line">
            <th scope="col" className="py-3 pr-3 font-normal">#</th>
            <th scope="col" className="py-3 pr-3 font-normal">Title</th>
            <th scope="col" className="hidden py-3 pr-3 font-normal md:table-cell">Category</th>
            <th scope="col" className="hidden py-3 pr-3 font-normal lg:table-cell">Source</th>
            <th scope="col" className="hidden py-3 pr-3 font-normal tabular-nums xl:table-cell">Rec in</th>
            <th scope="col" className="hidden py-3 pr-3 font-normal tabular-nums xl:table-cell">Rec out</th>
            <th scope="col" className="py-3 text-right font-normal">Dur</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, recIn, recOut }, i) => (
            <tr
              key={p.slug}
              data-cursor="Play"
              data-cursor-poster={p.poster}
              className="group relative border-b border-line transition-colors hover:bg-ink-2"
            >
              <td className="py-4 pr-3 align-top text-bone-dim tabular-nums">{String(i + 1).padStart(3, "0")}</td>
              <td className="py-4 pr-3">
                <button
                  type="button"
                  onClick={() => openPlayer(projects, i, { label: "Full index" })}
                  aria-label={`Play ${p.title}, ${p.format}, ${toSpokenRuntime(p.durationSeconds)}`}
                  className="text-left after:absolute after:inset-0 focus-visible:outline-none"
                >
                  <span className="block font-display text-xl leading-none tracking-normal text-bone transition-colors group-hover:text-rec group-focus-within:text-rec sm:text-2xl">
                    {p.title}
                  </span>
                  <span className="mt-1 block text-bone-dim">{p.format}</span>
                </button>
              </td>
              <td className="hidden py-4 pr-3 align-top text-bone-dim md:table-cell">
                {categories.find((c) => c.id === p.category)?.title}
              </td>
              <td className="hidden py-4 pr-3 align-top text-bone-dim normal-case lg:table-cell">
                {p.sourceFolder}/{p.sourceFile}
              </td>
              <td className="hidden py-4 pr-3 align-top text-bone-dim tabular-nums xl:table-cell">{toTimecode(recIn)}</td>
              <td className="hidden py-4 pr-3 align-top text-bone-dim tabular-nums xl:table-cell">{toTimecode(recOut)}</td>
              <td className="py-4 text-right align-top tabular-nums">{toRuntime(p.durationSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

import { aspectLabel, type Project } from "@/content/projects";
import { toRuntime } from "@/lib/timecode";

export function Caption({ project, n }: { project: Project; n: string }) {
  return (
    <div className="mt-3 flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <h3 className="truncate font-display text-2xl leading-tight uppercase sm:text-3xl">{project.title}</h3>
        <p className="font-mono text-[10px] tracking-[0.15em] text-bone-dim uppercase sm:text-[11px]">
          {project.format}
        </p>
      </div>
      <p className="shrink-0 font-mono text-[10px] tracking-[0.15em] text-bone-dim uppercase tabular-nums sm:text-[11px]">
        <span className="text-bone">{n}</span> · {aspectLabel(project)} · {toRuntime(project.durationSeconds)}
      </p>
    </div>
  );
}

import { PlayerProvider } from "@/components/player";
import { About, Contact } from "@/components/profile-sections";
import { SideRail } from "@/components/side-rail";
import { Workspace } from "@/components/workspace";
import { heroProject } from "@/content/projects";
import { profile } from "@/content/profile";

// One gutter for the window, the sections below it and the footer: ~2.5vw a
// side on desktop (window ≈ 92–95% of the viewport), widened on the left only
// where the floating rail is shown (xl+) so the rail sits in the margin.
const GUTTER = "px-2 sm:px-4 lg:px-[2.5vw] xl:pl-[max(2.5vw,4.5rem)]";

export default function Home() {
  return (
    <PlayerProvider>
      <a
        href="#work"
        className="sr-only z-[80] rounded-full bg-white px-4 py-2 text-[#18181b] focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to work
      </a>

      {/* The hero film's frame, blurred into the room light behind the glass. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop */}
        <img
          src={heroProject.poster}
          alt=""
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-[70px] saturate-75"
        />
      </div>

      <SideRail />

      <main id="top" className={`mx-auto flex w-full max-w-[2400px] flex-col gap-4 py-2 sm:gap-6 sm:py-5 lg:py-6 ${GUTTER}`}>
        <Workspace />
        <About />
        <Contact />
      </main>

      <footer className={`mx-auto w-full max-w-[2400px] pt-2 pb-8 text-xs text-[#2b2b2f] ${GUTTER}`}>
        <div className="flex flex-col gap-2 px-4 sm:flex-row sm:justify-between">
          <p>© {profile.name} · {profile.role}</p>
          <a href="#top" className="font-medium hover:underline">
            Back to top ↑
          </a>
        </div>
      </footer>
    </PlayerProvider>
  );
}

"use client";

import { useEffect, useState } from "react";
import { categories, showreel } from "@/content/projects";
import { ScrollTrigger } from "@/lib/gsap";
import { usePlayer } from "./player";

const LINKS = [...categories.map((c) => ({ id: c.id, index: c.index, title: c.title })), { id: "index", index: "04", title: "Index" }];

export function SiteHeader() {
  const { openPlayer } = usePlayer();
  const [active, setActive] = useState<string | null>(null);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const triggers = LINKS.flatMap(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return [];
      return ScrollTrigger.create({
        trigger: el,
        start: "top 50%",
        end: "bottom 50%",
        onToggle: (self) => setActive((cur) => (self.isActive ? id : cur === id ? null : cur)),
      });
    });
    const backdrop = ScrollTrigger.create({
      start: () => window.innerHeight * 0.85,
      end: "max",
      onToggle: (self) => setSolid(self.isActive),
    });
    return () => {
      triggers.forEach((t) => t.kill());
      backdrop.kill();
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 px-4 py-3 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors duration-300 sm:px-8 sm:py-4 sm:text-xs ${
        solid ? "border-b border-line bg-ink" : "border-b border-transparent"
      }`}
    >
      <a href="#top" className="flex items-center gap-2 text-bone">
        <span aria-hidden="true" className="size-1.5 bg-rec" />
        Basiumlabs
      </a>
      <nav aria-label="Sections" className="flex items-center gap-1 sm:gap-2">
        <ul className="flex">
          {LINKS.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                aria-current={active === l.id ? "location" : undefined}
                className="nav-link"
              >
                <span className={active === l.id ? "text-rec" : "text-bone"}>{l.index}</span>
                <span className="hidden lg:inline"> {l.title}</span>
                <span className="sr-only lg:hidden"> {l.title}</span>
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => openPlayer(showreel, 0, { label: "Showreel" })}
          className="ml-1 hidden items-center gap-2 border border-bone/30 px-3 py-2 uppercase transition-colors hover:border-rec hover:bg-rec sm:flex"
        >
          <span aria-hidden="true">▶</span> Showreel
        </button>
      </nav>
    </header>
  );
}

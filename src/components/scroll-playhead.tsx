"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "@/lib/gsap";

// REC-red playhead along the top edge tracking page progress, with a marker
// at each chapter. Direct feedback rather than decoration, so it stays on
// under reduced motion.
export function ScrollPlayhead() {
  const headRef = useRef<HTMLDivElement>(null);
  const [markers, setMarkers] = useState<number[]>([]);

  useEffect(() => {
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        if (headRef.current) headRef.current.style.transform = `scaleX(${self.progress})`;
      },
    });
    const measure = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const sections = document.querySelectorAll<HTMLElement>("[data-chapter], #index");
      setMarkers([...sections].map((s) => Math.min(1, (s.getBoundingClientRect().top + window.scrollY) / max)));
    };
    ScrollTrigger.addEventListener("refresh", measure);
    measure();
    return () => {
      st.kill();
      ScrollTrigger.removeEventListener("refresh", measure);
    };
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-0.5">
      <div ref={headRef} className="h-full origin-left scale-x-0 bg-rec" />
      {markers.map((m, i) => (
        <span key={i} className="absolute top-0 h-1.5 w-px bg-bone/50" style={{ left: `${m * 100}%` }} />
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-start justify-center gap-6 px-4 sm:px-8">
      <p className="font-mono text-xs tracking-[0.18em] text-bone-dim uppercase">
        <span className="text-rec">404</span> · Clip not found
      </p>
      <h1 className="font-display text-[clamp(3rem,12vw,9rem)] leading-[0.86] uppercase">Off the timeline</h1>
      <p className="max-w-md text-bone-dim">This page isn&apos;t part of the cut.</p>
      <Link href="/" className="btn-solid">
        Back to Basiumlabs
      </Link>
    </main>
  );
}

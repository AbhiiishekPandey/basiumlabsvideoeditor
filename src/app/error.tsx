"use client"; // Error boundaries must be Client Components

import Link from "next/link";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-svh flex-col items-start justify-center gap-6 px-4 sm:px-8">
      <p className="font-mono text-xs tracking-[0.18em] text-bone-dim uppercase">
        <span className="text-rec">Error</span> · Playback interrupted
      </p>
      <h1 className="font-display text-[clamp(3rem,12vw,9rem)] leading-[0.86] uppercase">Signal lost</h1>
      <p className="max-w-md text-bone-dim">Something went wrong loading this page.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => retry()} className="btn-solid">
          Try again
        </button>
        <Link href="/" className="btn-ghost-lg">
          Home
        </Link>
      </div>
    </main>
  );
}

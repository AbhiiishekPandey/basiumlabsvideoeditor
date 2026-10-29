"use client"; // Error boundaries must be Client Components

import Link from "next/link";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <div className="glass flex max-w-lg flex-col items-start gap-5 rounded-[32px] p-8 sm:p-10">
        <span className="tag">Error</span>
        <h1 className="text-[clamp(2rem,6vw,3rem)] leading-[1.05] font-semibold tracking-[-0.03em]">
          Something went wrong.
        </h1>
        <p className="text-fg-dim">This page didn&apos;t load properly.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => retry()} className="pill-solid">
            Try again
          </button>
          <Link href="/" className="pill-ghost">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

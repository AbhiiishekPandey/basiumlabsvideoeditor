import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <div className="glass flex max-w-lg flex-col items-start gap-5 rounded-[32px] p-8 sm:p-10">
        <span className="tag">404</span>
        <h1 className="text-[clamp(2rem,6vw,3rem)] leading-[1.05] font-semibold tracking-[-0.03em]">
          This page isn&apos;t in the edit.
        </h1>
        <p className="text-fg-dim">The link may be old or mistyped.</p>
        <Link href="/" className="pill-solid">
          Back to Abhishek Pandey
        </Link>
      </div>
    </main>
  );
}

import type { Metadata, Viewport } from "next";
import { Anton, Geist_Mono, Inter_Tight } from "next/font/google";
import { MediaPreconnect } from "@/components/media-preconnect";
import "./globals.css";

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Basiumlabs — Video Editing Portfolio";
const DESCRIPTION =
  "Basiumlabs edits product launches, long-form stories and short-form social — built on rhythm, pacing and the cut.";

export const metadata: Metadata = {
  title: { default: TITLE, template: "%s — Basiumlabs" },
  description: DESCRIPTION,
  applicationName: "Basiumlabs",
  creator: "Basiumlabs",
  openGraph: { type: "website", siteName: "Basiumlabs", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${interTight.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-svh">
        <MediaPreconnect />
        {children}
      </body>
    </html>
  );
}

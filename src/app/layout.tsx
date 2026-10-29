import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { MediaPreconnect } from "@/components/media-preconnect";
import { profile } from "@/content/profile";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const TITLE = `${profile.name} — Video Editor`;
const DESCRIPTION =
  "Video editing portfolio of Abhishek Pandey: product films, TEDx trailers and event promos, and short-form reels.";

// Absolute base for share images. On Vercel, Next falls back to the
// production URL; set NEXT_PUBLIC_SITE_URL for any other host or a custom domain.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: { default: TITLE, template: `%s — ${profile.name}` },
  description: DESCRIPTION,
  applicationName: profile.name,
  authors: [{ name: profile.name }],
  creator: profile.name,
  keywords: ["Abhishek Pandey", "video editor", "video editing portfolio", "reels", "product films", "TEDx"],
  openGraph: { type: "profile", siteName: profile.name, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#c3beb6",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-svh">
        <MediaPreconnect />
        {children}
      </body>
    </html>
  );
}

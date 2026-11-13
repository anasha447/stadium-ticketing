import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Each font is self-hosted by next/font and exposed as a CSS variable.
// globals.css maps the variables to --font-display / --font-sans / --font-mono.
const display = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  // next/font has no size metrics for this font, so it cannot build a
  // matched fallback; say so instead of letting the build warn.
  adjustFontFallback: false,
});

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Stadium Tickets",
    template: "%s · Stadium Tickets",
  },
  description:
    "Pick your seat in 3D, see the view from it, and hold it while you pay. A fan-made demo.",
};

export const viewport: Viewport = {
  themeColor: "#05070f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/lib/motion/SmoothScroll";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Grigor — Videography",
  description: "Selected work in film, video and motion.",
};

/**
 * The shell. Never remounts.
 *
 * The scroll engine lives here, above the route boundary — and so will the
 * persistent WebGL canvas and the audio provider, which §6.1 requires to
 * survive page transitions.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable}`}>
      <body>
        {/*
          Elements carrying `.enters-with-motion` are hidden by default so they
          never paint before their entrance animation runs. Reduced motion
          un-hides them via a media query in globals.css; this handles the other
          case, where JS never arrives to animate them at all (§7.2).

          Declarative on purpose. Doing this with a pre-hydration inline script
          means mutating <html> before React hydrates, which produces a
          hydration mismatch that can only be silenced with
          suppressHydrationWarning.
        */}
        <noscript>
          <style>{`.enters-with-motion{opacity:1}[data-brandmark]{--in:1}`}</style>
        </noscript>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}

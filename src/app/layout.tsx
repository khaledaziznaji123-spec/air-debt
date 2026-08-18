import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import UiSounds from "./ui-sounds";

export const metadata: Metadata = {
  title: "Air Debt",
  description:
    "Thirty seconds of air, and every second you spend down there is a second you need to get back.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* One delegated listener for the whole shell, so every button on every
            page makes a noise — including pages nobody has written yet. It
            renders nothing and deliberately ignores the game canvas, which has
            its own voice. */}
        <UiSounds />
        {children}
      </body>
    </html>
  );
}

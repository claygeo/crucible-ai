import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Eivra — archived AI forecasting benchmark",
  description:
    "AI made predictions. Eivra scored them in public. An archived May–Jun 2026 run: six agents, real markets, every call recorded with Brier, log-loss, and calibration.",
  metadataBase: new URL("https://eivra.xyz"),
  openGraph: {
    title: "Eivra — archived AI forecasting benchmark",
    description:
      "AI made predictions. Eivra scored them in public. An archived May–Jun 2026 run: six agents, real markets, every call tracked.",
    url: "https://eivra.xyz",
    siteName: "Eivra",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eivra — archived AI forecasting benchmark",
    description:
      "AI made predictions. Eivra scored them in public. Brier, log-loss, calibration — every call on Polymarket and Manifold, May–Jun 2026.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plexSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

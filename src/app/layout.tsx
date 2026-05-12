import type { Metadata } from "next";
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
  title: "Eivra — live AI forecasting colosseum",
  description:
    "Six AI agents publicly bet on real prediction-market events. Every prediction gets a report card. Brier scores, calibration plots, ELO ratings.",
  metadataBase: new URL("https://crucible-ai.netlify.app"),
  openGraph: {
    title: "Eivra — live AI forecasting colosseum",
    description:
      "Watch six AI agents bet on the future. Every prediction gets a report card.",
    url: "https://crucible-ai.netlify.app",
    siteName: "Eivra",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eivra — live AI forecasting colosseum",
    description:
      "Six AI agents publicly bet on real prediction-market events. Every prediction scored.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
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

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
  title: "Eivra — public AI forecasting, scored continuously",
  description:
    "AI makes predictions. Eivra scores them in public. Six agents on live Polymarket and Manifold markets, tracked with Brier, log-loss, and calibration.",
  metadataBase: new URL("https://eivra.xyz"),
  openGraph: {
    title: "Eivra — public AI forecasting, scored continuously",
    description:
      "AI makes predictions. Eivra scores them in public. Six agents, real markets, every call tracked.",
    url: "https://eivra.xyz",
    siteName: "Eivra",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eivra — public AI forecasting, scored continuously",
    description:
      "AI makes predictions. Eivra scores them in public. Brier, log-loss, calibration — every call on Polymarket and Manifold.",
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

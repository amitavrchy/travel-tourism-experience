import type { Metadata } from "next";
import { Manrope, Playfair_Display, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "./globals.css";
import "./readability.css";
import "./payments.css";

const manrope = Manrope({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});
const space = Space_Grotesk({
  variable: "--font-numerals",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: {
    default: "Wanderline — For the places that stay with you",
    template: "%s · Wanderline",
  },
  description:
    "Don’t book a trip. Compose a journey. Thoughtfully curated escapes, meaningful local experiences, and a personal itinerary inspired by you.",
  openGraph: {
    title: "Wanderline — Compose a journey",
    description: "For the places that stay with you.",
    images: ["/images/bali.jpg"],
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${playfair.variable} ${space.variable}`}
    >
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}

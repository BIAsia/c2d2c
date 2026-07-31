import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const title = "c2d2c — Code-to-design-to-code";
const description =
  "Four pipelines closing the loop between Figma and a production codebase: restore, export, govern, and Token Sync.";
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const metadataBase = new URL(
  productionHost ? `https://${productionHost}` : "http://localhost:3000",
);

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  openGraph: {
    type: "website",
    title,
    description,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

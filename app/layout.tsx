import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

const title = "Spider Archiver — Crawl & Archive Any Website";
const description =
  "Crawl any website and archive the results locally. Powered by Spider Cloud, the fastest web crawling infrastructure. Save, browse, and inspect HTML, markdown, and raw data.";
const url = process.env.PUBLIC_NEXT_SITENAME || "https://archiver.spider.cloud";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(url),
  keywords: [
    "web crawler",
    "spider cloud",
    "web archiver",
    "web scraping",
    "website crawler",
    "HTML viewer",
    "live crawling",
    "crawl viewer",
    "spider.cloud",
  ],
  authors: [{ name: "Spider", url: "https://spider.cloud" }],
  creator: "Spider",
  publisher: "Spider",
  openGraph: {
    type: "website",
    url,
    title,
    description,
    siteName: "Spider Cloud",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Spider Archiver — Crawl & Archive Any Website",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
    creator: "@spider_rust",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
  },
  alternates: {
    canonical: url,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Spider Archiver",
              url: "https://archiver.spider.cloud",
              description:
                "Crawl and archive the full HTML source of any website.",
              applicationCategory: "WebApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Organization",
                name: "Spider",
                url: "https://spider.cloud",
              },
            }),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}

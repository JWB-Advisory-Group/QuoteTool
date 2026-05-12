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

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://631solutions.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "631 Solutions — Long Island Exterior Cleaning",
    template: "%s · 631 Solutions",
  },
  description:
    "Fast, photo-confirmed quotes for house wash, windows, gutters, roof, patio, fence, and more. Local Suffolk County, fully insured. Call (631) 850-3601.",
  applicationName: "631 Solutions",
  keywords: [
    "exterior cleaning",
    "pressure washing",
    "soft wash",
    "house wash",
    "window cleaning",
    "gutter cleaning",
    "roof wash",
    "Huntington",
    "Northport",
    "Smithtown",
    "Cold Spring Harbor",
    "Suffolk County",
    "Long Island",
  ],
  openGraph: {
    title: "631 Solutions — Long Island Exterior Cleaning",
    description:
      "Photo-confirmed quotes in minutes for siding, windows, gutters, roof, patio, fence, and more. Insured, local, owner-operated.",
    url: siteUrl,
    siteName: "631 Solutions",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "631 Solutions — Long Island Exterior Cleaning",
    description:
      "Photo-confirmed quotes in minutes. Insured, local, owner-operated. Call (631) 850-3601.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

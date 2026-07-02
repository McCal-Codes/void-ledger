import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Void Ledger - TennoCon Baro Preparation",
  description: "Plan your TennoCon Baro Ki'Teer shopping with ducat tracking, relic farming estimates, and Prime part valuation",
  keywords: ["Warframe", "TennoCon", "Baro", "Ducats", "Relics", "Prime"],
  authors: [{ name: "McCal-Codes", url: "https://github.com/McCal-Codes" }],
  openGraph: {
    title: "Void Ledger - TennoCon Baro Preparation",
    description: "Plan your TennoCon Baro Ki'Teer shopping",
    type: "website",
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
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

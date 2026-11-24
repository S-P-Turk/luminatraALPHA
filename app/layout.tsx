import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/src/components/AppHeader";
import { Toaster } from "@/src/components/Toaster";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Luminatra — AI use analyzer for courses",
  description:
    "Students disclose how they used AI; Luminatra checks it against the syllabus and their understanding, and suggests follow-ups for teachers to review.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${sans.variable} ${serif.variable}`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div style={{ height: 57, borderBottom: "1px solid var(--lum-border)" }} />}>
          <AppHeader />
        </Suspense>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

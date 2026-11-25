import { Suspense } from "react";
import { JetBrains_Mono } from "next/font/google";
import AdminShell from "./AdminShell";

// Inter and Source Serif 4 come from the root layout; the ledger adds a
// monospace face for figures and labels.
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-admin-mono", display: "swap" });

export const metadata = { title: "Luminatra Admin" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className={mono.variable} style={{ flex: 1, display: "flex" }}>
      <style>{`.adm-cap::first-letter{text-transform:uppercase}`}</style>
      <Suspense fallback={null}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </div>
  );
}

import { Suspense } from "react";
import { Chivo, Chivo_Mono } from "next/font/google";
import AdminShell from "./AdminShell";

const sans = Chivo({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-admin-sans", display: "swap" });
const mono = Chivo_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-admin-mono", display: "swap" });

export const metadata = { title: "Luminatra Admin" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className={`${sans.variable} ${mono.variable}`} style={{ flex: 1, display: "flex" }}>
      <Suspense fallback={null}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </div>
  );
}

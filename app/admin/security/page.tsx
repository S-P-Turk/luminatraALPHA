import { Suspense } from "react";
import SecurityClient from "./SecurityClient";

export const instant = false;

export default function AdminSecurityPage() {
  return (
    <Suspense fallback={null}>
      <SecurityClient />
    </Suspense>
  );
}

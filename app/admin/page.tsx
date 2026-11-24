import { Suspense } from "react";
import OverviewClient from "./OverviewClient";

export const instant = false;

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={null}>
      <OverviewClient />
    </Suspense>
  );
}

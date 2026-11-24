import { Suspense } from "react";
import SpendingClient from "./SpendingClient";

export const instant = false;

export default function AdminSpendingPage() {
  return (
    <Suspense fallback={null}>
      <SpendingClient />
    </Suspense>
  );
}

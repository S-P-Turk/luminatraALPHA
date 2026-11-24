import { Suspense } from "react";
import LabClient from "./LabClient";

export const instant = false;

export default function AdminLabPage() {
  return (
    <Suspense fallback={null}>
      <LabClient />
    </Suspense>
  );
}

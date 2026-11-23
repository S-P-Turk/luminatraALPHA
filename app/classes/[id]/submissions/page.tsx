import { Suspense } from "react";
import SubmissionsClient from "./SubmissionsClient";

export const instant = false;

export default function ClassSubmissionsPage() {
  return (
    <Suspense fallback={null}>
      <SubmissionsClient />
    </Suspense>
  );
}

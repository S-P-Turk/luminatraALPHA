import { Suspense } from "react";
import AssignmentsClient from "./AssignmentsClient";

export const instant = false;

export default function ClassAssignmentsPage() {
  return (
    <Suspense fallback={null}>
      <AssignmentsClient />
    </Suspense>
  );
}

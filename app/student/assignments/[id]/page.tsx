import { Suspense } from "react";
import StudentAssignmentClient from "./StudentAssignmentClient";

export const instant = false;

export default function StudentAssignmentPage() {
  return (
    <Suspense fallback={null}>
      <StudentAssignmentClient />
    </Suspense>
  );
}

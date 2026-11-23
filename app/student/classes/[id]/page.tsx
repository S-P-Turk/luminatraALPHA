import { Suspense } from "react";
import StudentClassClient from "./StudentClassClient";

export const instant = false;

export default function StudentClassPage() {
  return (
    <Suspense fallback={null}>
      <StudentClassClient />
    </Suspense>
  );
}

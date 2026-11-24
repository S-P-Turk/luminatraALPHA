import { Suspense } from "react";
import QualityClient from "./QualityClient";

export const instant = false;

export default function AdminQualityPage() {
  return (
    <Suspense fallback={null}>
      <QualityClient />
    </Suspense>
  );
}

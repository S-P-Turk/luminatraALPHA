import { Suspense } from "react";
import ReviewClient from "./ReviewClient";

export const instant = false;

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewClient />
    </Suspense>
  );
}

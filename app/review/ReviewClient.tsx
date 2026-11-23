"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type ReviewSubmission } from "@/src/components/ReviewCard";
import { ReviewList } from "@/src/components/ReviewList";

// The teacher's single review inbox: everything that needs a decision, from
// every class, in one list.
export default function ReviewClient() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<ReviewSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/review");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load submissions.");
        return;
      }
      setSubmissions(data.submissions);
    })();
  }, [router]);

  function handleCleared(id: number, status: string) {
    setSubmissions((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, status } : s)) : prev));
  }

  return (
    <ReviewList
      title="Review — all classes"
      back={{ href: "/classes", label: "← Back to classes" }}
      submissions={submissions}
      error={error}
      showAll={showAll}
      setShowAll={setShowAll}
      onCleared={handleCleared}
    />
  );
}

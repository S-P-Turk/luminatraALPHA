"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { type ReviewSubmission } from "@/src/components/ReviewCard";
import { ReviewList } from "@/src/components/ReviewList";

// Per-class view of the same review list shown on /review.
export default function SubmissionsClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [className, setClassName] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<ReviewSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/classes/${params.id}/submissions`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load submissions.");
        return;
      }
      setClassName(data.class.name);
      setSubmissions(data.submissions);
    })();
  }, [params.id, router]);

  function handleCleared(id: number, status: string) {
    setSubmissions((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, status } : s)) : prev));
  }

  return (
    <ReviewList
      title={className ? `${className} — review` : "Review"}
      back={{ href: "/classes", label: "← Back to classes" }}
      submissions={submissions}
      error={error}
      showAll={showAll}
      setShowAll={setShowAll}
      onCleared={handleCleared}
    />
  );
}

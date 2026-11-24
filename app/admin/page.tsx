import { Suspense } from "react";
import AdminClient from "./AdminClient";

export const instant = false;

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminClient />
    </Suspense>
  );
}

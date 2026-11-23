import { redirect } from "next/navigation";
import { getCurrentTeacherEmail } from "@/src/lib/auth";

// Reads the auth cookie on every request to decide where to send the
// visitor, so this route can't be prerendered as static HTML.
export const instant = false;

export default async function Home() {
  const email = await getCurrentTeacherEmail();
  redirect(email ? "/classes" : "/login");
}

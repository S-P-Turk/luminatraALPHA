import { NextResponse } from "next/server";
import { getCurrentTeacherEmail } from "@/src/lib/auth";

export async function GET() {
  const email = await getCurrentTeacherEmail();
  return NextResponse.json({ email });
}

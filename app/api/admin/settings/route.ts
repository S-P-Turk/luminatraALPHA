import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/admin-auth";
import { getSettings, saveSetting } from "@/src/lib/ai";

// Budget settings: monthly budget ($), alert threshold (0..1), hard stop.
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (body?.monthlyBudget !== undefined) {
    const v = Number(body.monthlyBudget);
    if (!Number.isFinite(v) || v < 0 || v > 100000) {
      return NextResponse.json({ error: "Budget must be a dollar amount." }, { status: 400 });
    }
    await saveSetting("monthlyBudget", String(Math.round(v * 100) / 100));
  }
  if (body?.alertAt !== undefined) {
    const v = Number(body.alertAt);
    if (!Number.isFinite(v) || v <= 0 || v > 1) {
      return NextResponse.json({ error: "Alert must be between 1% and 100%." }, { status: 400 });
    }
    await saveSetting("alertAt", String(v));
  }
  if (typeof body?.hardStop === "boolean") await saveSetting("hardStop", String(body.hardStop));
  return NextResponse.json({ settings: await getSettings() });
}

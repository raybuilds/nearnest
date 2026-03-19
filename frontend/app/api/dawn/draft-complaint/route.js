import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const unitId = body?.unitId || "A-1508";
  const category = body?.category || "Other";
  const priority = body?.priority || "Medium";

  return NextResponse.json({
    unitId,
    category,
    priority,
    draft:
      `Dawn draft: Resident at unit ${unitId} reports a ${priority.toLowerCase()} priority ${String(category).toLowerCase()} issue requiring prompt review and resolution.`,
  });
}

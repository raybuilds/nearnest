import { NextResponse } from "next/server";
import { buildMockChatResponse } from "@/lib/mockData";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const message = body?.message || "";

  return NextResponse.json(buildMockChatResponse(message));
}

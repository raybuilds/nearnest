import { NextResponse } from "next/server";
import { mockComplaints } from "@/lib/mockData";

export async function GET() {
  return NextResponse.json(mockComplaints);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    id: `CMP-${Math.floor(1000 + Math.random() * 9000)}`,
    status: "submitted",
    ...body,
  });
}

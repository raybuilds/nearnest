import { NextResponse } from "next/server";
import { mockUnits } from "@/lib/mockData";

export async function GET() {
  return NextResponse.json(mockUnits);
}

import { fetchBackend, getForwardHeaders } from "@/app/api/_utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const corridorId = searchParams.get("corridorId");
  const maxRent = searchParams.get("maxRent");
  const maxDistance = searchParams.get("maxDistance");
  const ac = searchParams.get("ac");

  if (!corridorId) {
    return Response.json({ error: "Please specify unit or corridor" }, { status: 400 });
  }

  const params = new URLSearchParams();
  if (maxRent) params.set("maxRent", maxRent);
  if (maxDistance) params.set("maxDistance", maxDistance);
  if (ac) params.set("ac", ac);

  return fetchBackend(`/units/${corridorId}${params.toString() ? `?${params.toString()}` : ""}`, {
    headers: getForwardHeaders(request),
  });
}


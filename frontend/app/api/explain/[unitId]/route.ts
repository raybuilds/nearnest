import { fetchBackend, getForwardHeaders } from "@/app/api/_utils";

export async function GET(request: Request, { params }: { params: { unitId: string } }) {
  return fetchBackend("/dawn/query", {
    method: "POST",
    headers: getForwardHeaders(request),
    body: {
      message: `Explain trust score for unit ${params.unitId}`,
      intent: "explain_unit_trust",
    },
  });
}


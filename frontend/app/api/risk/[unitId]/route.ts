import { fetchBackend, getForwardHeaders } from "@/app/api/_utils";

export async function GET(request: Request, { params }: { params: { unitId: string } }) {
  const role = (request.headers.get("x-nearnest-role") || "").toLowerCase();

  if (role === "landlord") {
    return fetchBackend("/dawn/query", {
      method: "POST",
      headers: getForwardHeaders(request),
      body: {
        message: `Show risk summary for unit ${params.unitId}`,
        intent: "landlord_risk",
      },
    });
  }

  return fetchBackend("/dawn/query", {
    method: "POST",
    headers: getForwardHeaders(request),
    body: {
      message: `Why is unit ${params.unitId} risky`,
      intent: "predict_unit_risk",
    },
  });
}


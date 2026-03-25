import { fetchBackend, getForwardHeaders } from "@/app/api/_utils";

export async function GET(request: Request, { params }: { params: { unitId: string } }) {
  return fetchBackend("/dawn/query", {
    method: "POST",
    headers: getForwardHeaders(request),
    body: {
      message: `What should I fix first on unit ${params.unitId}`,
      intent: "landlord_remediation_advisor",
    },
  });
}


import { fetchBackend, getForwardHeaders } from "@/app/api/_utils";

export async function GET(request: Request, { params }: { params: { unitId: string } }) {
  return fetchBackend(`/unit/${params.unitId}/explain`, {
    headers: getForwardHeaders(request),
  });
}


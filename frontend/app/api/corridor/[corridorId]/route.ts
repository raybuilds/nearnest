import { fetchBackend, getForwardHeaders } from "@/app/api/_utils";

export async function GET(request: Request, { params }: { params: { corridorId: string } }) {
  return fetchBackend(`/corridor/${params.corridorId}/overview`, {
    headers: getForwardHeaders(request),
  });
}


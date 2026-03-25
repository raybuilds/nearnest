const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;

type BackendOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export function getForwardHeaders(request: Request, extraHeaders: Record<string, string> = {}) {
  const authorization = request.headers.get("authorization");
  const role = request.headers.get("x-nearnest-role");

  return {
    ...(authorization ? { Authorization: authorization } : {}),
    ...(role ? { "x-nearnest-role": role } : {}),
    ...extraHeaders,
  };
}

export async function fetchBackend(path: string, options: BackendOptions = {}) {
  if (!BACKEND_BASE) {
    return new Response(
      JSON.stringify({
        error: "NEXT_PUBLIC_API_URL is not configured for the frontend deployment.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const response = await fetch(`${BACKEND_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    return new Response(
      JSON.stringify({
        error: data?.error ?? data?.message ?? "Unable to retrieve data",
      }),
      {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return Response.json(data);
}

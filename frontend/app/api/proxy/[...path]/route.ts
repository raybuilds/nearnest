import { fetchBackend, getForwardHeaders } from "@/app/api/_utils";

async function forward(request: Request, { params }: { params: { path: string[] } }) {
  const path = `/${(params.path || []).join("/")}`;
  const url = new URL(request.url);
  const query = url.search || "";
  const method = request.method;

  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const isFormData = contentType.includes("multipart/form-data");

  const headers = getForwardHeaders(request);

  if (isFormData) {
    const formData = await request.formData();
    return fetchBackend(`${path}${query}`, {
      method,
      headers,
      formData,
    });
  }

  const body = method === "GET" || method === "HEAD" ? undefined : isJson ? await request.json() : undefined;

  return fetchBackend(`${path}${query}`, {
    method,
    headers,
    body,
  });
}

export async function GET(request: Request, context: { params: { path: string[] } }) {
  return forward(request, context);
}

export async function POST(request: Request, context: { params: { path: string[] } }) {
  return forward(request, context);
}

export async function PUT(request: Request, context: { params: { path: string[] } }) {
  return forward(request, context);
}

export async function PATCH(request: Request, context: { params: { path: string[] } }) {
  return forward(request, context);
}

export async function DELETE(request: Request, context: { params: { path: string[] } }) {
  return forward(request, context);
}


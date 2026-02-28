const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getAuthToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const baseHeaders = isFormData ? { ...authHeader } : { "Content-Type": "application/json", ...authHeader };

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { ...baseHeaders, ...(options.headers || {}) },
    ...options,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || "Request failed");
  }

  return payload;
}

export { BASE_URL };

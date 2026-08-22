"use client";

import { getStoredRole } from "@/lib/session";

type ApiOptions = {
  method?: string;
  body?: unknown;
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const role = getStoredRole();

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(role ? { "x-nearnest-role": role } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? "Unable to retrieve data");
  }

  return payload as T;
}

export const apiClient = {
  getTrust: (unitId: number | string) => request(`/api/trust/${unitId}`),
  getRecommendations: (query: Record<string, string | number | boolean | null | undefined>) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    });
    return request(`/api/recommendations?${params.toString()}`);
  },
  getRisk: (unitId: number | string) => request(`/api/risk/${unitId}`),
  getExplain: (unitId: number | string) => request(`/api/explain/${unitId}`),
  getCorridor: (corridorId: number | string) => request(`/api/corridor/${corridorId}`),
  getRemediation: (unitId: number | string) => request(`/api/remediation/${unitId}`),
  getOperations: (intent?: string) =>
    request(`/api/operations${intent ? `?intent=${encodeURIComponent(intent)}` : ""}`),
};


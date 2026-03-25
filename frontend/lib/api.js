const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest(path, { method = "GET", body, isFormData = false } = {}) {
  if (!BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured for the frontend.");
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
  };

  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const networkError = new Error(
      `NearNest could not reach the backend at ${BASE}. Please make sure the backend server is running.`
    );
    networkError.cause = error;
    networkError.code = "BACKEND_UNAVAILABLE";
    throw networkError;
  }

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login?reason=session-expired";
    }
    return undefined;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message ?? data?.error ?? "Request failed");
  }

  return data;
}

export const login = (body) => apiRequest("/auth/login", { method: "POST", body });
export const register = (body) => apiRequest("/auth/register", { method: "POST", body });

export const getCorridors = () => apiRequest("/corridors");
export const getInstitutions = (corridorId) => apiRequest(`/institutions/${corridorId}`);
export const joinVDP = (body) => apiRequest("/vdp", { method: "POST", body });

export const getUnits = (corridorId, query = "") => apiRequest(`/units/${corridorId}${query ? `?${query}` : ""}`);
export const getHiddenReasons = (corridorId) => apiRequest(`/units/${corridorId}/hidden-reasons`);
export const getStudentUnitDetail = (id) => apiRequest(`/student/unit/${id}/details`);
export const explainUnit = (id) => apiRequest(`/unit/${id}/explain`);
export const shortlistUnit = (body) => apiRequest("/shortlist", { method: "POST", body });

export const createComplaint = (body) => apiRequest("/complaint", { method: "POST", body });
export const resolveComplaint = (id) => apiRequest(`/complaint/${id}/resolve`, { method: "PATCH" });
export const getComplaints = (query = "") => apiRequest(`/complaints${query ? `?${query}` : ""}`);
export const getUnitComplaints = (id) => apiRequest(`/unit/${id}/complaints`);

export const getProfile = () => apiRequest("/profile");

export const createUnit = (body) => apiRequest("/unit", { method: "POST", body });
export const putStructuralCL = (id, body) => apiRequest(`/unit/${id}/structural-checklist`, { method: "PUT", body });
export const putOperationalCL = (id, body) => apiRequest(`/unit/${id}/operational-checklist`, { method: "PUT", body });
export const uploadMedia = (id, formData) => apiRequest(`/unit/${id}/media`, { method: "POST", body: formData, isFormData: true });
export const submitUnit = (id) => apiRequest(`/unit/${id}/submit`, { method: "POST" });
export const getLandlordUnits = () => apiRequest("/landlord/units");
export const getDemandSummary = (corridorId) => apiRequest(`/landlord/corridor/${corridorId}/demand-summary`);
export const getInterestedStudents = (id) => apiRequest(`/landlord/unit/${id}/interested-students`);
export const getLandlordOverview = (id) => apiRequest(`/landlord/unit/${id}/overview`);
export const getLandlordComplaints = (id) => apiRequest(`/landlord/unit/${id}/complaints`);
export const getLandlordAuditLogs = (id) => apiRequest(`/landlord/unit/${id}/audit-logs`);
export const checkIn = (body) => apiRequest("/occupancy/check-in", { method: "POST", body });
export const checkOut = (id) => apiRequest(`/occupancy/${id}/check-out`, { method: "PATCH" });

export const createCorridor = (body) => apiRequest("/corridor", { method: "POST", body });
export const createInstitution = (body) => apiRequest("/institutions", { method: "POST", body });
export const getAdminUnits = (corridorId) => apiRequest(`/admin/units/${corridorId}`);
export const reviewUnit = (id, body) => apiRequest(`/admin/unit/${id}/review`, { method: "PATCH", body });
export const patchStructuralCL = (id, body) => apiRequest(`/admin/unit/${id}/structural-checklist`, { method: "PATCH", body });
export const patchOperationalCL = (id, body) => apiRequest(`/admin/unit/${id}/operational-checklist`, { method: "PATCH", body });
export const triggerAudit = (id, body) => apiRequest(`/admin/unit/${id}/audit-log`, { method: "POST", body });
export const penalizeSelfDecl = (id, body) => apiRequest(`/admin/unit/${id}/self-declaration/penalize`, { method: "POST", body });
export const getAuditSample = (corridorId, count) => apiRequest(`/admin/audit/sample/${corridorId}?count=${count}`);
export const setCorrectivePlan = (id, body) => apiRequest(`/admin/audit-log/${id}/corrective-plan`, { method: "PATCH", body });
export const resolveAuditLog = (id, body) => apiRequest(`/admin/audit-log/${id}/resolve`, { method: "PATCH", body });
export const getAdminAuditLogs = (id) => apiRequest(`/admin/unit/${id}/audit-logs`);
export const getAdminAuditQueue = (corridorId) => apiRequest(`/admin/audit/${corridorId}`);
export const getAdminUnitDetail = (id) => apiRequest(`/admin/unit/${id}/details`);
export const getAdminDemand = (corridorId) => apiRequest(`/admin/corridor/${corridorId}/demand`);

export const getCorridorOverview = (corridorId) => apiRequest(`/corridor/${corridorId}/overview`);
export const getCorridorDemand = (corridorId) => apiRequest(`/corridor/${corridorId}/demand`);

export const getDawnInsights = () => apiRequest("/dawn/insights");
export const queryDawn = (body) => apiRequest("/dawn/query", { method: "POST", body });

export { BASE };

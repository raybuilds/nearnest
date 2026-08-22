const BASE = "/api/proxy";

export async function apiRequest(path, { method = "GET", body, isFormData = false } = {}) {
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
      "NearNest could not reach the backend. Please make sure the backend server is running."
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

export async function audioRequest(path, { method = "POST", body } = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };

  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const networkError = new Error(
      "NearNest could not reach the backend. Please make sure the backend server is running."
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

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
    throw new Error(data?.message ?? data?.error ?? "Audio request failed");
  }

  return {
    blob: await response.blob(),
    headers: response.headers,
  };
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
async function audioRequestAbsolute(path, { method = "POST", body } = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login?reason=session-expired";
    }
    return undefined;
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
    throw new Error(data?.message ?? data?.error ?? "Audio request failed");
  }

  return {
    blob: await response.blob(),
    headers: response.headers,
  };
}

export async function speakDawn(body) {
  try {
    return await audioRequestAbsolute("/api/dawn/speak", { method: "POST", body });
  } catch (_) {
    return audioRequest("/dawn/speak", { method: "POST", body });
  }
}

export const getParentDashboard = () => apiRequest("/parent/dashboard");
export const checkInGuest = (body) => apiRequest("/guest/check-in", { method: "POST", body });
export const checkOutGuest = (id) => apiRequest(`/guest/${id}/check-out`, { method: "PATCH" });
export const getGuestStays = () => apiRequest("/guest/stays");
export const getLandlordGuestStays = (unitId) => apiRequest(`/landlord/unit/${unitId}/guest-stays`);
export const getPaymentLedger = () => apiRequest("/payment/ledger");
export const submitPayment = (body) => apiRequest("/payment/submit", { method: "POST", body });
export const verifyPayment = (id) => apiRequest(`/payment/${id}/verify`, { method: "PATCH" });
export const overridePayment = (id, body) => apiRequest(`/admin/payment/${id}/override`, { method: "PATCH", body });
export const getStudentAgreements = () => apiRequest("/api/student/agreements");
export const signTenantAgreement = (id) => apiRequest(`/api/agreement/${id}/sign-tenant`, { method: "PATCH" });
export const signLandlordAgreement = (id) => apiRequest(`/api/agreement/${id}/sign-landlord`, { method: "PATCH" });
export const submitAgreement = (id) => apiRequest(`/api/agreement/${id}/submit`, { method: "PATCH" });
export const createAgreement = (body) => apiRequest("/api/agreement", { method: "POST", body });
export const createAgreementVersion = (id, body) => apiRequest(`/api/agreement/${id}/version`, { method: "POST", body });
export const getParentChildAgreements = () => apiRequest("/api/parent/child-agreements");
export const getLandlordCompliance = (unitId) => apiRequest(`/api/landlord/unit/${unitId}/compliance`);
export const uploadCompliance = (unitId, formData) => apiRequest(`/api/landlord/unit/${unitId}/compliance`, { method: "POST", body: formData, isFormData: true });
export const verifyCompliance = (id, body) => apiRequest(`/api/compliance/${id}/verify`, { method: "PATCH", body });
export const getAdminCompliance = () => apiRequest("/api/compliance");
export const terminateAgreement = (id, body) => apiRequest(`/api/agreement/${id}/terminate`, { method: "PATCH", body });
export const getAdminAgreements = () => apiRequest("/api/agreements");

export const getLandlordPayments = (unitId) => apiRequest(`/landlord/unit/${unitId}/payments`);
export const getAdminPayments = () => apiRequest("/admin/payments");
export const getLandlordAgreements = (unitId) => apiRequest(`/api/landlord/unit/${unitId}/agreements`);

export const getStudentAnalytics = () => apiRequest("/api/student/analytics");
export const getParentAnalytics = () => apiRequest("/api/parent/analytics");
export const getLandlordUnitAnalytics = (unitId) => apiRequest(`/api/landlord/unit/${unitId}/analytics`);
export const getAdminAnalytics = () => apiRequest("/api/admin/analytics");

export const getAlerts = (status = "", page = 1) => apiRequest(`/api/alerts?status=${status}&page=${page}`);
export const readAlert = (id) => apiRequest(`/api/alerts/${id}/read`, { method: "PATCH" });
export const acknowledgeAlert = (id) => apiRequest(`/api/alerts/${id}/acknowledge`, { method: "PATCH" });
export const resolveAlert = (id) => apiRequest(`/api/alerts/${id}/resolve`, { method: "PATCH" });
export const dismissAlert = (id) => apiRequest(`/api/alerts/${id}/dismiss`, { method: "PATCH" });

export { BASE };

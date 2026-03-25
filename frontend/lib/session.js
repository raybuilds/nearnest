"use client";

function emitSessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("nearnest:session-changed"));
}

export function getStoredRole() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("role") || "";
}

export function getStoredUser() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  [
    "token",
    "role",
    "user",
    "studentId",
    "landlordId",
    "userName",
  ].forEach((key) => localStorage.removeItem(key));
  emitSessionChange();
}

export function setSessionFromPayload(payload) {
  if (typeof window === "undefined") return;

  localStorage.setItem("token", payload?.token || "");
  localStorage.setItem("role", payload?.user?.role || "");
  localStorage.setItem("user", JSON.stringify(payload?.user || {}));
  localStorage.setItem("userName", payload?.user?.name || "");

  if (payload?.studentId !== null && payload?.studentId !== undefined) {
    localStorage.setItem("studentId", String(payload.studentId));
  } else {
    localStorage.removeItem("studentId");
  }

  if (payload?.landlordId !== null && payload?.landlordId !== undefined) {
    localStorage.setItem("landlordId", String(payload.landlordId));
  } else {
    localStorage.removeItem("landlordId");
  }

  emitSessionChange();
}

export function requireSessionOrRedirect() {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    return false;
  }
  return true;
}

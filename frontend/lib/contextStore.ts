"use client";

import type { DawnContext, DawnIntent, DawnRole } from "@/types/dawn";

const CONTEXT_KEY = "nearnest:dawn-context";

export function createDefaultContext(role: DawnRole = "student"): DawnContext {
  return {
    role,
    lastUnitId: null,
    lastCorridorId: null,
    lastIntent: null,
    lastFilters: {},
    sessionHistory: [],
    timestamp: new Date().toISOString(),
  };
}

export function readContext(role: DawnRole): DawnContext {
  if (typeof window === "undefined") return createDefaultContext(role);

  try {
    const raw = window.localStorage.getItem(CONTEXT_KEY);
    if (!raw) return createDefaultContext(role);
    const parsed = JSON.parse(raw) as Partial<DawnContext>;
    return {
      ...createDefaultContext(role),
      ...parsed,
      role,
    };
  } catch {
    return createDefaultContext(role);
  }
}

export function writeContext(context: DawnContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CONTEXT_KEY,
    JSON.stringify({
      ...context,
      timestamp: new Date().toISOString(),
    })
  );
}

export function resetContext(role: DawnRole) {
  const next = createDefaultContext(role);
  writeContext(next);
  return next;
}

export function updateContext(role: DawnRole, patch: Partial<DawnContext>) {
  const current = readContext(role);
  const next = {
    ...current,
    ...patch,
    role,
    timestamp: new Date().toISOString(),
  };
  writeContext(next);
  return next;
}

export function pushHistory(role: DawnRole, message: string) {
  const current = readContext(role);
  const sessionHistory = [...current.sessionHistory, message].slice(-10);
  return updateContext(role, { sessionHistory });
}

export function detectUnitId(input: string, fallback?: number | null) {
  const match = input.match(/unit\s*(?:#|id\s*)?(\d+)/i) || input.match(/\b(\d{1,6})\b/);
  if (match) return Number(match[1]);
  return fallback ?? null;
}

export function detectCorridorId(input: string, fallback?: number | null) {
  const match = input.match(/corridor\s*(?:#|id\s*)?(\d+)/i);
  if (match) return Number(match[1]);
  return fallback ?? null;
}

export function deriveLastIntent(intents: DawnIntent[]): DawnIntent | null {
  return intents[0] ?? null;
}


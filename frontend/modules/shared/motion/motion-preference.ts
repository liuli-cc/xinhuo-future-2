"use client";

import { useEffect, useSyncExternalStore } from "react";

export type MotionPreference = "system" | "full" | "reduced";

export const MOTION_PREFERENCE_STORAGE_KEY = "xinhuo:motion-preference";

const DEFAULT_MOTION_PREFERENCE: MotionPreference = "system";
const preferenceListeners = new Set<() => void>();
const systemMotionListeners = new Set<() => void>();

let cachedPreference: MotionPreference = DEFAULT_MOTION_PREFERENCE;
let preferenceHydrated = false;
let systemMotionQuery: MediaQueryList | null = null;

function isMotionPreference(value: string | null): value is MotionPreference {
  return value === "system" || value === "full" || value === "reduced";
}

function hydratePreference() {
  if (preferenceHydrated || typeof window === "undefined") return;
  preferenceHydrated = true;
  try {
    const stored = window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY);
    cachedPreference = isMotionPreference(stored) ? stored : DEFAULT_MOTION_PREFERENCE;
  } catch {
    cachedPreference = DEFAULT_MOTION_PREFERENCE;
  }
}

function getPreferenceSnapshot() {
  hydratePreference();
  return cachedPreference;
}

function getServerPreferenceSnapshot() {
  return DEFAULT_MOTION_PREFERENCE;
}

function subscribeClientReady() {
  return () => undefined;
}

function getClientReadySnapshot() {
  return true;
}

function getServerClientReadySnapshot() {
  return false;
}

function emitPreferenceChange() {
  preferenceListeners.forEach(listener => listener());
}

function handleStorageChange(event: StorageEvent) {
  if (event.key !== null && event.key !== MOTION_PREFERENCE_STORAGE_KEY) return;
  cachedPreference = isMotionPreference(event.newValue) ? event.newValue : DEFAULT_MOTION_PREFERENCE;
  preferenceHydrated = true;
  emitPreferenceChange();
}

function subscribePreference(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  hydratePreference();
  preferenceListeners.add(listener);
  if (preferenceListeners.size === 1) window.addEventListener("storage", handleStorageChange);
  return () => {
    preferenceListeners.delete(listener);
    if (preferenceListeners.size === 0) window.removeEventListener("storage", handleStorageChange);
  };
}

function getSystemMotionQuery() {
  if (typeof window === "undefined") return null;
  systemMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return systemMotionQuery;
}

function getSystemReducedMotionSnapshot() {
  return getSystemMotionQuery()?.matches ?? false;
}

function subscribeSystemMotion(listener: () => void) {
  const query = getSystemMotionQuery();
  if (!query) return () => undefined;
  systemMotionListeners.add(listener);
  if (systemMotionListeners.size === 1) {
    query.addEventListener("change", emitSystemMotionChange);
  }
  return () => {
    systemMotionListeners.delete(listener);
    if (systemMotionListeners.size === 0) {
      query.removeEventListener("change", emitSystemMotionChange);
    }
  };
}

function emitSystemMotionChange() {
  systemMotionListeners.forEach(listener => listener());
}

export function setMotionPreference(preference: MotionPreference) {
  cachedPreference = preference;
  preferenceHydrated = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MOTION_PREFERENCE_STORAGE_KEY, preference);
    } catch {
      // Storage can be unavailable in hardened browser modes; the in-memory choice still applies.
    }
  }
  emitPreferenceChange();
}

export function useMotionPreference() {
  const clientReady = useSyncExternalStore(
    subscribeClientReady,
    getClientReadySnapshot,
    getServerClientReadySnapshot,
  );
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot,
  );
  const systemReducedMotion = useSyncExternalStore(
    subscribeSystemMotion,
    getSystemReducedMotionSnapshot,
    () => false,
  );
  // Treat hydration as reduced motion until the stored choice and media query are both authoritative.
  // This prevents a one-frame entrance animation for people who already chose reduced motion.
  const reducedMotion = !clientReady || preference === "reduced" || (preference === "system" && systemReducedMotion);

  useEffect(() => {
    if (!clientReady) return;
    document.documentElement.dataset.motionPreference = preference;
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [clientReady, preference, reducedMotion]);

  return {
    preference,
    reducedMotion,
    motionReady: clientReady,
    systemReducedMotion,
    setPreference: setMotionPreference,
  };
}

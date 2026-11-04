const RECOVERY_KEY = "fin3a:module-load-recovery";
const RETRY_WINDOW_MS = 60_000;

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i.test(message);
}

// Reload only failed page assets, never failed account requests or mutations.
// Storage is required so a persistently missing asset cannot cause a reload loop.
export function recoverModuleLoad(error: unknown, browser: {
  storage: Pick<Storage, "getItem" | "setItem">;
  reload: () => void;
  now: () => number;
}): boolean {
  if (!isModuleLoadError(error)) return false;
  try {
    const now = browser.now();
    const previous = browser.storage.getItem(RECOVERY_KEY);
    if (previous !== null && now - Number(previous) < RETRY_WINDOW_MS) return false;
    browser.storage.setItem(RECOVERY_KEY, String(now));
  } catch {
    return false;
  }
  browser.reload();
  return true;
}

export function recoverBrowserModuleLoad(error: unknown): boolean {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  try {
    return recoverModuleLoad(error, {
      storage: window.sessionStorage,
      reload: () => window.location.reload(),
      now: Date.now,
    });
  } catch {
    return false;
  }
}
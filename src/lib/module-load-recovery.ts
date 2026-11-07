const RECOVERY_KEY = "fin3a:module-load-recovery";
const RETRY_WINDOW_MS = 60_000;

// The preview access layer can return this HTML instead of an RPC response.
// Recognize the exact signal; never execute returned HTML or treat all 401s as reloads.
export function isPreviewReloadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /<html\b/i.test(message) && /window\.parent\.postMessage\(\s*\{\s*type:\s*["']FORCE_RELOAD["']\s*\},\s*["']\*["']\s*\)/.test(message);
}

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|evaluating '[a-z]\[[a-z]\s*\?\?\s*[`'"]default[`'"]\]'|Cannot read properties of undefined \(reading 'default'\)/i.test(message);
}

// Reload failed page assets or the preview's explicit access-refresh signal.
// Never replay a request or mutation.
// Storage is required so a persistently missing asset cannot cause a reload loop.
export function recoverModuleLoad(error: unknown, browser: {
  storage: Pick<Storage, "getItem" | "setItem">;
  reload: () => void;
  now: () => number;
}): boolean {
  if (!isModuleLoadError(error) && !isPreviewReloadError(error)) return false;
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
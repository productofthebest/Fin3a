// Transient connection drops (Safari "Load failed", Chrome "Failed to fetch",
// Firefox "NetworkError…") happen when a phone wakes, switches networks or the
// tab resumes. They are not app defects, so page reads retry quietly instead of
// blanking the screen. Only use this for reads — never retry money movements.

const NETWORK_ERROR = /^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?|Network request failed|The network connection was lost\.?)$/i;

export function isTransientNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return NETWORK_ERROR.test(message.trim());
}

export const NETWORK_READ_ATTEMPTS = 4;

export function networkRetryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 4_000);
}

export async function withNetworkRetry<T>(
  read: () => Promise<T>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (!isTransientNetworkError(error) || attempt >= NETWORK_READ_ATTEMPTS - 1) throw error;
      await wait(networkRetryDelay(attempt));
    }
  }
}

// TanStack Query retry rule: keep the existing single retry for ordinary
// failures, give connection drops a few more chances.
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < (isTransientNetworkError(error) ? NETWORK_READ_ATTEMPTS - 1 : 1);
}

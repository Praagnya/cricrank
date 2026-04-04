/** Transient failures (mobile networks, cold API, spotty LTE) often surface as TypeError / AbortError. */

const RETRYABLE_STATUS = new Set([502, 503, 504]);

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export type FetchWithRetryOptions = {
  /** Total attempts including the first try (default 3). */
  attempts?: number;
  /** Per-attempt timeout in ms (default 28_000). */
  timeoutMs?: number;
};

/**
 * Browser fetch with timeout, retries on network errors / abort, and on 502–504.
 * Does not retry 4xx (except you can extend later for 429).
 */
export async function fetchWithRetry(
  input: string,
  init: RequestInit = {},
  options?: FetchWithRetryOptions
): Promise<Response> {
  const attempts = options?.attempts ?? 3;
  const timeoutMs = options?.timeoutMs ?? 28_000;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return res;
      if (RETRYABLE_STATUS.has(res.status) && attempt < attempts - 1) {
        await sleep(280 * Math.pow(2, attempt));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      const retriable =
        e instanceof TypeError ||
        (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError");
      if (retriable && attempt < attempts - 1) {
        await sleep(280 * Math.pow(2, attempt));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

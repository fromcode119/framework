export class SystemStatusUtils {
  static readonly REQUEST_TIMEOUT_MS = 5000;

  static async fetchWithTimeout(
    input: RequestInfo | URL, 
    init: RequestInit = {}, 
    timeoutMs = SystemStatusUtils.REQUEST_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

export class FrontendApiBaseUrl {
  static resolveFrontendApiBaseUrl(explicit?: string): string {
      const fromExplicit = FrontendApiBaseUrl.normalizeCandidate(String(explicit || ''));
      if (fromExplicit) return fromExplicit;

      const fromBridge =
        typeof window !== 'undefined' ? FrontendApiBaseUrl.normalizeCandidate(FrontendApiBaseUrl.readBridgeValue('FROMCODE_API_URL')) : '';
      if (fromBridge) return fromBridge;

      const fromEnv = FrontendApiBaseUrl.normalizeCandidate(String(process.env.NEXT_PUBLIC_API_URL || ''));
      if (fromEnv) return fromEnv;

      const fromLocation = FrontendApiBaseUrl.inferFromBrowserLocation();
      if (fromLocation) return fromLocation;

      return '';

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static trimTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, '');
  }

  private static normalizeCandidate(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return FrontendApiBaseUrl.trimTrailingSlashes(raw);
    }
    if (raw.startsWith('/')) return FrontendApiBaseUrl.trimTrailingSlashes(raw);
    return FrontendApiBaseUrl.trimTrailingSlashes(`http://${raw}`);
  }

  private static readBridgeValue(key: string): string {
    if (typeof window === 'undefined') return '';
    return String((window as any)?.[key] || '').trim();
  }

  private static parseOriginMap(raw: string): Record<string, string> {
    const normalized = String(raw || '').trim();
    if (!normalized) return {};
    try {
      const parsed = JSON.parse(normalized);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
        const mapKey = String(key || '').trim();
        const mapValue = FrontendApiBaseUrl.normalizeCandidate(String(value || ''));
        if (mapKey && mapValue) acc[mapKey] = mapValue;
        return acc;
      }, {});
    } catch {
      return {};
    }
  }

  private static inferFromBrowserLocation(): string {
    if (typeof window === 'undefined') return '';
    try {
      const current = new URL(window.location.href);
      const origin = FrontendApiBaseUrl.trimTrailingSlashes(current.origin);
      const host = String(current.hostname || '').trim();

      const originMap = {
        ...FrontendApiBaseUrl.parseOriginMap(String(process.env.NEXT_PUBLIC_API_ORIGIN_MAP || '')),
        ...FrontendApiBaseUrl.parseOriginMap(FrontendApiBaseUrl.readBridgeValue('FROMCODE_API_ORIGIN_MAP'))
      };

      const mapped = FrontendApiBaseUrl.normalizeCandidate(
        originMap[origin] ||
        originMap[host] ||
        ''
      );
      if (mapped) return mapped;

      // Neutral fallback: same origin with versioned API path (/api/vX) appended by route builders.
      return origin;
    } catch {
      // Ignore inference failures and fallback.
    }
    return '';
  }
}
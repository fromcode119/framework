function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeCandidate(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return trimTrailingSlashes(raw);
  }
  if (raw.startsWith('/')) return trimTrailingSlashes(raw);
  return trimTrailingSlashes(`http://${raw}`);
}

function readBridgeValue(key: string): string {
  if (typeof window === 'undefined') return '';
  return String((window as any)?.[key] || '').trim();
}

function parseOriginMap(raw: string): Record<string, string> {
  const normalized = String(raw || '').trim();
  if (!normalized) return {};
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
      const mapKey = String(key || '').trim();
      const mapValue = normalizeCandidate(String(value || ''));
      if (mapKey && mapValue) acc[mapKey] = mapValue;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function inferFromBrowserLocation(): string {
  if (typeof window === 'undefined') return '';
  try {
    const current = new URL(window.location.href);
    const origin = trimTrailingSlashes(current.origin);
    const host = String(current.hostname || '').trim();

    const originMap = {
      ...parseOriginMap(String(process.env.NEXT_PUBLIC_API_ORIGIN_MAP || '')),
      ...parseOriginMap(readBridgeValue('FROMCODE_API_ORIGIN_MAP'))
    };

    const mapped = normalizeCandidate(
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

export function resolveFrontendApiBaseUrl(explicit?: string): string {
  const fromExplicit = normalizeCandidate(String(explicit || ''));
  if (fromExplicit) return fromExplicit;

  const fromBridge =
    typeof window !== 'undefined' ? normalizeCandidate(readBridgeValue('FROMCODE_API_URL')) : '';
  if (fromBridge) return fromBridge;

  const fromEnv = normalizeCandidate(String(process.env.NEXT_PUBLIC_API_URL || ''));
  if (fromEnv) return fromEnv;

  const fromLocation = inferFromBrowserLocation();
  if (fromLocation) return fromLocation;

  return '';
}

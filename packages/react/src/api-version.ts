function readApiVersionFromEnv(): string {
  if (typeof process === 'undefined' || !process?.env) return '';
  return String(
    process.env.NEXT_PUBLIC_API_VERSION ||
      process.env.API_VERSION_PREFIX ||
      process.env.DEFAULT_API_VERSION ||
      ''
  ).trim();
}

export function normalizeApiVersion(value?: any): string {
  const raw = String(value ?? readApiVersionFromEnv()).trim();
  if (!raw) return '';

  const withoutApiPrefix = raw.replace(/^\/?api\//i, '').replace(/^\/+/, '');
  const cleaned = withoutApiPrefix.replace(/^\/+|\/+$/g, '');
  if (!cleaned) return '';

  return cleaned.startsWith('v') ? cleaned : `v${cleaned}`;
}

export function buildApiVersionPrefix(value?: any): string {
  const normalizedVersion = normalizeApiVersion(value);
  return normalizedVersion ? `/api/${normalizedVersion}` : '/api';
}


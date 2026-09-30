import { describe, expect, it } from 'vitest';
import { RequestSurfaceHelper } from '@core/request-surface-helper';

/**
 * `normalizePathname` only tries `new URL` when the input has a scheme. That must be the SAME answer the
 * old always-try version gave: `new URL(value)` with no base fails for every input without one.
 */
function reference(value: unknown): string {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return '';
  try {
    return reference(new URL(normalizedValue).pathname);
  } catch {}
  const withoutQueryOrHash = normalizedValue.split('?')[0].split('#')[0].trim();
  if (!withoutQueryOrHash) return '';
  const withLeadingSlash = withoutQueryOrHash.startsWith('/') ? withoutQueryOrHash : `/${withoutQueryOrHash}`;
  const compacted = withLeadingSlash.replace(/\/{2,}/g, '/');
  return compacted.length === 1 ? compacted : compacted.replace(/\/+$/, '');
}

const INPUTS = [
  '', '   ', '/', '/api/v1/health', '/api/v1/plugins/widgets/items?limit=20', 'api/v1//x//', '/a/b/#frag',
  '//evil.example.com/path', 'https://console.example.com/admin/users?x=1', 'http://h:3000', 'HTTP://H/X/',
  'localhost:3000/x', 'c:/windows', 'mailto:someone@example.com', 'javascript:alert(1)', '?only=query', '#hash',
  '/ü/ä?x', 'https://example.com/%E2%9C%93/', 'x+y.z-1:rest', '1http://no-scheme', null, undefined, 42,
];

describe('RequestSurfaceHelper.normalizePathname', () => {
  it.each(INPUTS.map((v) => [v]))('matches the always-try-URL behaviour for %j', (input) => {
    expect(RequestSurfaceHelper.normalizePathname(input)).toBe(reference(input));
  });
});

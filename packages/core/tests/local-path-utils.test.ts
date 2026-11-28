import { describe, expect, it } from 'vitest';
import { LocalPathUtils } from '@core/utils/local-path-utils';

describe('LocalPathUtils.safe', () => {
  it.each(['/advent', '/a/b?x=1#y', '/'])('keeps the same-site path %s', (path) => {
    expect(LocalPathUtils.safe(path)).toBe(path);
  });

  it.each([
    'https://evil.test', '//evil.test', '/\\evil.test', '/\t/evil.test', '/\n/evil.test', '/ /evil.test',
    'advent', '', undefined, null, 42, `/${'a'.repeat(600)}`,
  ])('refuses %j', (value) => {
    expect(LocalPathUtils.safe(value)).toBe('');
  });
});

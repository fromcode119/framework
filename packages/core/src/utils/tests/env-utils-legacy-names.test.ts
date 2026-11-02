import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvUtils } from '@core/utils/env-utils';

/**
 * Variables are named after the brand (`FROMCODE_*`), never a release. The release-named spelling
 * an existing `.env` still carries (`ATLANTIS_*`) must keep resolving, or that installation reads
 * its own setting as unset.
 */
describe('EnvUtils brand-named variables', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('reads the FROMCODE_ name', () => {
    vi.stubEnv('FROMCODE_TEST_UPDATER', 'off');
    expect(EnvUtils.text('FROMCODE_TEST_UPDATER')).toBe('off');
  });

  it('falls back to the ATLANTIS_ spelling and says it is deprecated', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('ATLANTIS_TEST_LEGACY_ONLY', 'image');
    expect(EnvUtils.text('FROMCODE_TEST_LEGACY_ONLY')).toBe('image');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ATLANTIS_TEST_LEGACY_ONLY is deprecated'));
  });

  it('prefers the FROMCODE_ name when both are set', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('FROMCODE_TEST_BOTH', 'on');
    vi.stubEnv('ATLANTIS_TEST_BOTH', 'off');
    expect(EnvUtils.text('FROMCODE_TEST_BOTH')).toBe('on');
  });

  it('applies to flags and numbers too', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('ATLANTIS_TEST_FLAG', 'true');
    vi.stubEnv('ATLANTIS_TEST_NUMBER', '42');
    expect(EnvUtils.flag('FROMCODE_TEST_FLAG')).toBe(true);
    expect(EnvUtils.number('FROMCODE_TEST_NUMBER', 0)).toBe(42);
  });
});

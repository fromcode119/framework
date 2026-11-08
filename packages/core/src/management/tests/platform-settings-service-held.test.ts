import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { ApiResponseCache } from '@core/plugin/context/api-response-cache';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';

/**
 * A platform setting is read by every storefront render and every internal call; each read was a database
 * round trip. It is now kept — until a saved setting announces itself, and never past the operator's maximum age.
 */
describe('PlatformSettingsService keeps what it read', () => {
  const service = PlatformSettingsService as any;
  let stored: Record<string, string | null>;
  let reads: number;
  let age: number;

  beforeEach(() => {
    stored = { site_search_indexing: 'true' };
    reads = 0;
    age = 60;
    service.kept.clear();
    ApiResponseCache.useMaxAge(() => age);
    PlatformSettingsService.registerAccessor(async (key: string) => { reads += 1; return stored[key] ?? null; });
  });
  afterEach(() => { vi.useRealTimers(); ApiResponseCache.useMaxAge(() => 0); service.kept.clear(); });

  it('reads a setting once, however many readers ask', async () => {
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBe('true');
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBe('true');
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBe('true');
    expect(reads).toBe(1);
  });

  it('keeps "no value" too, so an unset setting is not asked for again on every call', async () => {
    expect(await PlatformSettingsService.getSetting('site_environment')).toBeNull();
    expect(await PlatformSettingsService.getSetting('site_environment')).toBeNull();
    expect(reads).toBe(1);
  });

  it('reads again once a setting was saved (SETTINGS_WRITTEN) or the caches were purged (CACHE_PURGED)', async () => {
    await PlatformSettingsService.getSetting('site_search_indexing');
    stored.site_search_indexing = 'false';
    ProcessSignals.announce(ProcessSignal.SETTINGS_WRITTEN, { keys: ['site_search_indexing'] });
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBe('false');
    stored.site_search_indexing = 'true';
    ProcessSignals.announce(ProcessSignal.CACHE_PURGED, {});
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBe('true');
    expect(reads).toBe(3);
  });

  it('never keeps an answer past the operator\'s maximum age', async () => {
    vi.useFakeTimers();
    await PlatformSettingsService.getSetting('site_search_indexing');
    stored.site_search_indexing = 'false';
    vi.advanceTimersByTime(59_000);
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBe('true');
    vi.advanceTimersByTime(2_000);
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBe('false');
  });

  it('keeps nothing while the operator has turned the cache off (maximum age 0)', async () => {
    age = 0;
    await PlatformSettingsService.getSetting('site_search_indexing');
    await PlatformSettingsService.getSetting('site_search_indexing');
    expect(reads).toBe(2);
  });

  it('does not keep a failed read: the next reader asks again', async () => {
    let fail = true;
    PlatformSettingsService.registerAccessor(async () => { reads += 1; if (fail) throw new Error('db down'); return 'true'; });
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBeNull();
    fail = false;
    expect(await PlatformSettingsService.getSetting('site_search_indexing')).toBe('true');
    expect(reads).toBe(2);
  });

  it('still refuses a site-scoped key before anything is kept', async () => {
    await expect(PlatformSettingsService.getSetting('default_locale')).rejects.toThrow();
    expect(service.kept.size).toBe(0);
  });
});

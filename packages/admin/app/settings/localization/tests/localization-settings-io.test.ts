import { LocaleUrlStrategy, MeasurementSystem } from '@fromcode119/core/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAll = vi.fn();
const update = vi.fn();

vi.mock('@/lib/settings/admin-system-settings-client', () => ({
  AdminSystemSettingsClient: {
    getAll: (...args: unknown[]) => getAll(...args),
    update: (...args: unknown[]) => update(...args),
  },
}));

import { LocalizationSettingsIo } from '@/app/settings/localization/localization-settings-io';

describe('LocalizationSettingsIo', () => {
  beforeEach(() => {
    getAll.mockReset();
    update.mockReset();
  });

  describe('load', () => {
    it('returns an EMPTY registry when nothing is stored — it never invents English', async () => {
      getAll.mockResolvedValue({});

      const loaded = await LocalizationSettingsIo.load();

      expect(loaded.locales).toEqual([]);
      expect(loaded.defaultLocale).toBe('');
      expect(loaded.adminDefaultLocale).toBe('');
      expect(loaded.frontendDefaultLocale).toBe('');
    });

    it('offers no locale options for an empty registry', () => {
      expect(LocalizationSettingsIo.buildSelectOptions([])).toEqual([]);
    });

    it('reads the stored registry as-is', async () => {
      getAll.mockResolvedValue({
        localization_locales: '[{"code":"bg","name":"Bulgarian","enabled":true},{"code":"de","name":"German","enabled":false}]',
        default_locale: 'bg',
        admin_default_locale: 'bg',
        frontend_default_locale: 'bg',
        locale_url_strategy: 'path',
        measurement_system: 'imperial',
      });

      const loaded = await LocalizationSettingsIo.load();

      expect(loaded.locales.map((locale) => locale.code)).toEqual(['bg', 'de']);
      expect(loaded.defaultLocale).toBe('bg');
      expect(loaded.localeUrlStrategy).toBe(LocaleUrlStrategy.PATH);
      expect(loaded.measurementSystem).toBe(MeasurementSystem.IMPERIAL);
    });

    it('reads the registry the API ACTUALLY returns — an already-parsed array, not a JSON string', async () => {
      // The suite above mocks `localization_locales` as a STRING, which is not what the endpoint sends:
      // `getSettings` returns `toExposableSettingsMap(rows, { parseJson: true })`, so JSON-shaped settings
      // arrive parsed. `load()` used to `String(value ?? '')` every value, turning this array into
      // "[object Object],[object Object]" — the whole Localization screen then failed to load with
      // "`localization_locales` is not valid JSON" and Save stayed disabled, on a perfectly valid row.
      getAll.mockResolvedValue({
        localization_locales: [
          { code: 'en', name: 'English', enabled: true },
          { code: 'bg', name: 'Bulgarian', enabled: true },
        ],
        default_locale: 'bg',
        admin_default_locale: 'en',
        frontend_default_locale: 'bg',
        locale_url_strategy: 'query',
        measurement_system: 'metric',
      });

      const loaded = await LocalizationSettingsIo.load();

      expect(loaded.locales.map((locale) => locale.code)).toEqual(['en', 'bg']);
      expect(loaded.locales.map((locale) => locale.name)).toEqual(['English', 'Bulgarian']);
      expect(loaded.defaultLocale).toBe('bg');
      expect(loaded.adminDefaultLocale).toBe('en');
      expect(loaded.localeUrlStrategy).toBe(LocaleUrlStrategy.QUERY);
      expect(loaded.measurementSystem).toBe(MeasurementSystem.METRIC);
    });

    it('REJECTS on a corrupt stored registry instead of reporting "no locales configured"', async () => {
      // Swallowing the parse error rendered an empty registry, and saving from that empty form then
      // overwrote the real (unreadable) configuration.
      getAll.mockResolvedValue({ localization_locales: '{not json' });

      await expect(LocalizationSettingsIo.load()).rejects.toThrow(/localization_locales/);
    });

    it('propagates a failed settings request — the page must show an error, not seeds', async () => {
      getAll.mockRejectedValue(new Error('Network request failed'));

      await expect(LocalizationSettingsIo.load()).rejects.toThrow('Network request failed');
    });
  });

  describe('save', () => {
    it('persists measurement_system — the control previously wrote to nothing', async () => {
      update.mockResolvedValue(undefined);

      await LocalizationSettingsIo.save(
        [{ id: 'bg-0', code: 'bg', name: 'Bulgarian', enabled: true }],
        { defaultLocale: 'bg', adminDefaultLocale: 'bg', frontendDefaultLocale: 'bg' },
        LocaleUrlStrategy.PATH,
        MeasurementSystem.IMPERIAL,
      );

      const payload = update.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.measurement_system).toBe('imperial');
      // `.value`, never the Enum instance — every consumer of these settings reads a plain string.
      expect(payload.locale_url_strategy).toBe('path');
      expect(payload.enabled_locales).toBe('bg');
    });
  });
});

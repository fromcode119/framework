import { describe, expect, it, vi } from 'vitest';
import { PluginTelemetryService } from '@core/plugin/services/health/plugin-telemetry-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The weekly digest runs from CRON — no request, no tenant.
 *
 * The journal policy answers an untenanted, unmarked read with the `tenant_id IS NULL` rows alone, so
 * the mail to the platform's operators reported platform rows only and silently omitted every site's.
 * Measured on one deployment: 5,465 of the journal's rows belong to sites, 63,234 do not, and the
 * scan takes only the 2,000 most recent — a site's error could essentially never appear. It read as
 * a quiet week.
 */
describe('the weekly telemetry digest reads every site', () => {
  const service = (db: any) => {
    const telemetry: any = new PluginTelemetryService(db, () => ({ send: vi.fn(async () => true) }) as any, {} as any);
    telemetry.isEmailTelemetryEnabled = async () => true;
    telemetry.getEmailTelemetryRecipients = async () => ['ops@example.test'];
    return telemetry;
  };

  it('asks for the platform marker before scanning the journal', async () => {
    const seen = { marked: false, scannedInsideMarker: false };
    const db: any = {
      withPlatformAdmin: async (fn: () => Promise<unknown>) => { seen.marked = true; return fn(); },
      find: vi.fn(async (table: string) => {
        if (table === SystemConstants.TABLE.LOGS) seen.scannedInsideMarker = seen.marked;
        return [];
      }),
      findOne: async () => null,
      insert: async () => ({}),
    };

    await service(db).sendWeeklyEmailTelemetryDigest();

    expect(seen.marked).toBe(true);
    // Not merely that the marker was opened — that the SCAN happened inside it.
    expect(seen.scannedInsideMarker).toBe(true);
  });

  it('still produces a digest when the journal cannot be read at all', async () => {
    // A failing scan must not take the weekly mail down with it; it reports what it has.
    const db: any = {
      withPlatformAdmin: async (fn: () => Promise<unknown>) => fn(),
      find: vi.fn(async () => { throw new Error('journal unavailable'); }),
      findOne: async () => null,
      insert: async () => ({}),
    };

    await expect(service(db).sendWeeklyEmailTelemetryDigest()).resolves.not.toThrow();
  });
});

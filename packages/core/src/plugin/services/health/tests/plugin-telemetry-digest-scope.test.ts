import { describe, expect, it, vi } from 'vitest';
import { PluginTelemetryService } from '@core/plugin/services/health/plugin-telemetry-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The weekly digest runs from CRON — no request, no tenant.
 *
 * The journal policy answers an untenanted, unmarked read with the `tenant_id IS NULL` rows alone, so
 * the mail to the platform's operators reported platform rows only and silently omitted every site's.
 * How much that hid varies by deployment — on a real platform the site rows were roughly a third of
 * the journal — but they were never visible at all, on any of them. It read as a quiet week.
 */
describe('the weekly telemetry digest reads every site', () => {
  const service = (db: any) => {
    const telemetry: any = new PluginTelemetryService(db, () => ({ send: vi.fn(async () => true) }) as any, {} as any);
    telemetry.isEmailTelemetryEnabled = async () => true;
    telemetry.getEmailTelemetryRecipients = async () => ['ops@example.test'];
    // Telemetry refuses to invent an address to reach the operator, so a double has to supply one.
    telemetry.resolveSender = async () => ({ isConfigured: true, identity: 'Platform <ops@example.test>' });
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

  it('says it could not look, rather than reporting a quiet week', async () => {
    // The same disease one layer out: an operator cannot tell "nothing happened" from "I could not
    // look", and those call for opposite responses. A failing scan must still not take the mail down.
    const sent: any[] = [];
    const db: any = {
      withPlatformAdmin: async (fn: () => Promise<unknown>) => fn(),
      find: vi.fn(async () => { throw new Error('journal unavailable'); }),
      findOne: async () => null,
      insert: async () => ({}),
    };
    const telemetry: any = new PluginTelemetryService(
      db, () => ({ send: vi.fn(async (message: any) => { sent.push(message); return true; }) }) as any, {} as any,
    );
    telemetry.isEmailTelemetryEnabled = async () => true;
    telemetry.getEmailTelemetryRecipients = async () => ['ops@example.test'];
    telemetry.resolveSender = async () => ({ isConfigured: true, identity: 'Platform <ops@example.test>' });

    await expect(telemetry.sendWeeklyEmailTelemetryDigest()).resolves.not.toThrow();

    expect(sent).toHaveLength(1);
    expect(`${sent[0].text}${sent[0].html}`).toContain('could not be read');
    expect(`${sent[0].text}${sent[0].html}`).toContain('journal unavailable');
  });
});

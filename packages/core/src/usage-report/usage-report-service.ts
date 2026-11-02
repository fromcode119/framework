import { randomUUID } from 'crypto';
import os from 'os';
import { MarketplaceUrlService } from '@fromcode119/marketplace-client';
import { SystemConstants } from '@core/constants/system.constants';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemUpdateService } from '@core/management/system-update-service';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';
import { UsageReportDefaults } from '@core/usage-report/usage-report-defaults';
import type { IUsageReport } from '@core/usage-report/interfaces/usage-report.interface';
import type { IUsageReportStatus } from '@core/usage-report/interfaces/usage-report-status.interface';

/**
 * The usage report: what it says, where it goes, and sending it.
 *
 * The report is built from this installation's own state and nothing else — a random id, versions, the
 * number of sites and the plugins in use. It names no site, domain, person or address, and it is sent
 * without the marketplace key so it cannot be tied to a client. The admin shows exactly what `build()`
 * returns, so the preview and what is sent are the same object.
 */
export class UsageReportService {
  static readonly TIMEOUT_MS = 8000;

  constructor(private readonly manager: any) {} // eslint-disable-line @typescript-eslint/no-explicit-any

  private get db(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    return this.manager.db;
  }

  async enabled(): Promise<boolean> {
    return PlatformSettingsService.readFlag(SystemConstants.META_KEY.USAGE_REPORT_ENABLED);
  }

  /** The address the operator set, or the declared default when they left it blank. */
  async address(): Promise<string> {
    return PlatformSettingsService.resolve(undefined, SystemConstants.META_KEY.USAGE_REPORT_URL, UsageReportDefaults.ADDRESS);
  }

  /** The URL the report is posted to, derived from the address the way the catalogue's is. */
  async target(): Promise<string> {
    return MarketplaceUrlService.resolveUsageReportUrl(await this.address());
  }

  async build(): Promise<IUsageReport> {
    return {
      installId: await this.installId(),
      frameworkVersion: SystemUpdateService.installedVersion(),
      nodeVersion: process.versions.node,
      database: String(this.db?.dialect ?? ''),
      platform: `${os.platform()}/${os.arch()}`,
      sites: await this.sites(),
      plugins: this.plugins(),
    };
  }

  /** Sends the report now, whatever the switch says — the caller decides. Records and returns the outcome. */
  async send(now: Date = new Date()): Promise<IUsageReportStatus> {
    const target = await this.target();
    const status = target
      ? await this.post(target, await this.build(), now)
      : { at: now.toISOString(), ok: false, target: '', message: 'The address is not an http(s) address.' };
    await this.writeMeta(SystemConstants.META_KEY.USAGE_REPORT_STATUS, JSON.stringify(status));
    return status;
  }

  /** The scheduled run: sends only while the operator's switch is on. */
  async run(now: Date = new Date()): Promise<IUsageReportStatus | null> {
    if (!(await this.enabled())) return null;
    return this.send(now);
  }

  async status(): Promise<IUsageReportStatus | null> {
    const raw = await this.readMeta(SystemConstants.META_KEY.USAGE_REPORT_STATUS);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as IUsageReportStatus;
    } catch {
      return null;
    }
  }

  private async post(target: string, report: IUsageReport, now: Date): Promise<IUsageReportStatus> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UsageReportService.TIMEOUT_MS);
    const at = now.toISOString();
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        signal: controller.signal,
      });
      return response.ok
        ? { at, ok: true, target, message: `Accepted (${response.status}).` }
        : { at, ok: false, target, message: `The address answered ${response.status}.` };
    } catch (error) {
      return { at, ok: false, target, message: `Could not reach the address: ${String((error as Error)?.message || error)}` };
    } finally {
      clearTimeout(timer);
    }
  }

  /** The id is made once, the first time a report is built, and kept: a new id would count as a new installation. */
  private async installId(): Promise<string> {
    const existing = await this.readMeta(SystemConstants.META_KEY.USAGE_REPORT_INSTALL_ID);
    if (existing) return existing;
    const id = randomUUID();
    await this.writeMeta(SystemConstants.META_KEY.USAGE_REPORT_INSTALL_ID, id);
    return id;
  }

  private async sites(): Promise<number> {
    if (!TenantMode.isEnabled()) return 1;
    const registry = new TenantRegistryService(this.db, TenantResolverService.shared(this.db));
    return this.db.withPlatformAdmin(() => registry.count());
  }

  /** Installed plugins by slug and version. Bundled ones are part of the framework version already. */
  private plugins(): { slug: string; version: string }[] {
    return (this.manager.getPlugins() as unknown[])
      .map((plugin: any) => plugin?.manifest) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((manifest: any) => manifest?.slug && manifest?.bundled !== true) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((manifest: any) => ({ slug: String(manifest.slug), version: String(manifest.version ?? '') })) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort((a: { slug: string }, b: { slug: string }) => a.slug.localeCompare(b.slug));
  }

  private async readMeta(key: string): Promise<string> {
    const row = await this.db.withPlatformAdmin(() => this.db.findOne(SystemConstants.TABLE.META, { key }));
    return String(row?.value ?? '').trim();
  }

  private async writeMeta(key: string, value: string): Promise<void> {
    await this.db.withPlatformAdmin(async () => {
      const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.META, { key }, { value, updated_at: new Date() });
        return;
      }
      await this.db.insert(SystemConstants.TABLE.META, { key, value, group: 'usage-report', description: 'Written by the usage report.' });
    });
  }
}

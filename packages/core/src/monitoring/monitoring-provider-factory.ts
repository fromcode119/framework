import type { IIntegrationResolved } from '@core/integrations/interfaces/integration-resolved.interface';
import type { IMonitoringProvider } from '@core/monitoring/interfaces/monitoring-provider.interface';
import { EmailMonitoringProvider } from '@core/monitoring/providers/email-monitoring-provider';
import { UptimeRobotMonitoringProvider } from '@core/monitoring/providers/uptimerobot-monitoring-provider';
import { BetterStackMonitoringProvider } from '@core/monitoring/providers/betterstack-monitoring-provider';
import { PlatformMailUnavailableEmailDriver } from '@core/integrations/platform-mail-unavailable-email-driver';

/**
 * Turns the active `monitoring` integration entries into working providers. With nothing configured the
 * type resolves its default, `email`, so a fresh platform still tells its admins. A provider a plugin
 * registered into this type is built by its own `create`.
 */
export class MonitoringProviderFactory {
  constructor(private readonly manager: any) {}

  async active(): Promise<Array<{ key: string; provider: IMonitoringProvider }>> {
    const resolved: IIntegrationResolved[] = await this.manager.integrations.resolveMany('monitoring');
    const providers: Array<{ key: string; provider: IMonitoringProvider }> = [];
    for (const entry of resolved ?? []) {
      providers.push({ key: entry.providerKey, provider: await this.build(entry) });
    }
    return providers;
  }

  /**
   * Whether the active providers actually tell anyone about the platform's own incidents, and whether the
   * platform has a mail server of its own. The email provider sends through the platform's mail; when that
   * is the mock — nothing configured in platform scope — every alert is logged and dropped, so email only
   * counts when the platform's mail is real. An outside watcher (UptimeRobot) never delivers incidents.
   */
  async delivery(active: Array<{ key: string; provider: IMonitoringProvider }>): Promise<{ alerting: boolean; platformMail: boolean }> {
    const platformMail = !PlatformMailUnavailableEmailDriver.isMock(await this.manager.integrations.resolveMany('email'));
    const alerting = active.some(({ key, provider }) => Boolean(provider.notify) && (key !== 'email' || platformMail));
    return { alerting, platformMail };
  }

  private async build(entry: IIntegrationResolved): Promise<IMonitoringProvider> {
    const config = entry.config ?? {};
    if (entry.providerKey === 'email') return new EmailMonitoringProvider(this.manager);
    if (entry.providerKey === 'uptimerobot') return new UptimeRobotMonitoringProvider(String(config.apiKey ?? ''), String(config.namePrefix ?? ''), Number(config.interval) || 0, Number(config.timeout) || 0);
    if (entry.providerKey === 'betterstack') return new BetterStackMonitoringProvider(String(config.apiToken ?? ''), String(config.namePrefix ?? ''));
    return (await entry.provider.create(config)) as IMonitoringProvider;
  }
}

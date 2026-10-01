import type { IIntegrationResolved } from '@core/integrations/interfaces/integration-resolved.interface';
import type { IMonitoringProvider } from '@core/monitoring/interfaces/monitoring-provider.interface';
import { EmailMonitoringProvider } from '@core/monitoring/providers/email-monitoring-provider';
import { UptimeRobotMonitoringProvider } from '@core/monitoring/providers/uptimerobot-monitoring-provider';
import { BetterStackMonitoringProvider } from '@core/monitoring/providers/betterstack-monitoring-provider';

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

  private async build(entry: IIntegrationResolved): Promise<IMonitoringProvider> {
    const config = entry.config ?? {};
    if (entry.providerKey === 'email') return new EmailMonitoringProvider(this.manager);
    if (entry.providerKey === 'uptimerobot') return new UptimeRobotMonitoringProvider(String(config.apiKey ?? ''), String(config.namePrefix ?? ''), Number(config.interval) || 0);
    if (entry.providerKey === 'betterstack') return new BetterStackMonitoringProvider(String(config.apiToken ?? ''), String(config.namePrefix ?? ''));
    return (await entry.provider.create(config)) as IMonitoringProvider;
  }
}

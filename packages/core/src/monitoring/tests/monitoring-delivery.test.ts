import { describe, expect, it } from 'vitest';
import { MonitoringProviderFactory } from '@core/monitoring/monitoring-provider-factory';

/**
 * Whether anyone is actually told. The email provider sends through the platform's own mail; with nothing
 * configured in platform scope that is the mock, which logs every alert and drops it — measured on
 * production, where the monitor's alerts all ended as `[Email:Mock] Sending`.
 */
describe('MonitoringProviderFactory.delivery', () => {
  const factory = (emailProviders: string[]) => new MonitoringProviderFactory({
    integrations: { resolveMany: async () => emailProviders.map((providerKey) => ({ providerKey })) },
  });
  const email = { key: 'email', provider: { notify: async () => undefined } };
  const uptimeRobot = { key: 'uptimerobot', provider: { syncTargets: async () => undefined } };

  it('does not count email as alerting while the platform mail is the mock', async () => {
    expect(await factory(['mock']).delivery([email, uptimeRobot])).toEqual({ alerting: false, platformMail: false });
  });

  it('counts email once the platform has a real mail server', async () => {
    expect(await factory(['smtp']).delivery([email, uptimeRobot])).toEqual({ alerting: true, platformMail: true });
  });

  it('never counts an outside watcher as delivering the platform’s own incidents', async () => {
    expect(await factory(['smtp']).delivery([uptimeRobot])).toEqual({ alerting: false, platformMail: true });
  });
});

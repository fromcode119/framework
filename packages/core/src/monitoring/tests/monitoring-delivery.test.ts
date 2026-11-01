import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonitoringProviderFactory } from '@core/monitoring/monitoring-provider-factory';
import { EmailMonitoringProvider } from '@core/monitoring/providers/email-monitoring-provider';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';

/**
 * Whether anyone is actually told. The email provider sends through the platform's own mail; with nothing
 * configured in platform scope that is the mock, which logs every alert and drops it — measured on
 * production, where the monitor's alerts all ended as `[Email:Mock] Sending`. And a real mail server still
 * tells nobody when the email provider has no one to write to.
 */
describe('MonitoringProviderFactory.delivery', () => {
  afterEach(() => vi.restoreAllMocks());

  const factory = (emailProviders: string[]) => new MonitoringProviderFactory({
    integrations: { resolveMany: async () => emailProviders.map((providerKey) => ({ providerKey })) },
  });
  const email = (recipients: string[]) => {
    vi.spyOn(NotificationsContextProxy, 'adminRecipients').mockResolvedValue(recipients);
    return { key: 'email', provider: new EmailMonitoringProvider({}, []) };
  };
  const uptimeRobot = { key: 'uptimerobot', provider: { syncTargets: async () => undefined } };

  it('does not count email as alerting while the platform mail is the mock', async () => {
    expect(await factory(['mock']).delivery([email(['ops@example.com']), uptimeRobot]))
      .toEqual({ alerting: false, platformMail: false, emailRecipients: ['ops@example.com'] });
  });

  it('counts email once the platform has a real mail server and someone to write to', async () => {
    expect(await factory(['smtp']).delivery([email(['ops@example.com']), uptimeRobot]))
      .toEqual({ alerting: true, platformMail: true, emailRecipients: ['ops@example.com'] });
  });

  it('does not count email that has no recipient', async () => {
    expect(await factory(['smtp']).delivery([email([])])).toEqual({ alerting: false, platformMail: true, emailRecipients: [] });
  });

  it('never counts an outside watcher as delivering the platform’s own incidents', async () => {
    expect(await factory(['smtp']).delivery([uptimeRobot])).toEqual({ alerting: false, platformMail: true, emailRecipients: [] });
  });
});

describe('MonitoringProviderFactory email provider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mails the addresses entered on the provider as well as the admins', async () => {
    const adminRecipients = vi.spyOn(NotificationsContextProxy, 'adminRecipients').mockResolvedValue([]);
    const manager = {
      integrations: { resolveMany: async () => [{ providerKey: 'email', config: { recipients: 'a@example.com, b@example.com' } }] },
    };
    const [{ provider }] = await new MonitoringProviderFactory(manager).active();
    await (provider as EmailMonitoringProvider).recipients();
    expect(adminRecipients).toHaveBeenCalledWith(manager, ['a@example.com', 'b@example.com']);
  });
});

describe('NotificationsContextProxy.adminRecipients', () => {
  it('joins the extra addresses, the notification addresses and the admins, once each', async () => {
    const meta: Record<string, string> = { notification_email: 'Ops@Example.com', notification_email_cc: 'cc@example.com; ops@example.com' };
    const manager: any = {
      db: { findOne: async (_table: string, where: { key: string }) => (meta[where.key] ? { value: meta[where.key] } : null) },
    };
    const { RolesContextProxy } = await import('@core/plugin/context/roles');
    vi.spyOn(RolesContextProxy, 'createRolesProxy').mockReturnValue({ listUserEmailsWithRole: async () => ['admin@example.com'] } as any);
    expect(await NotificationsContextProxy.adminRecipients(manager, ['extra@example.com']))
      .toEqual(['extra@example.com', 'ops@example.com', 'cc@example.com', 'admin@example.com']);
    vi.restoreAllMocks();
  });
});

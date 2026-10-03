import { describe, it, expect } from 'vitest';
import { InstallationChecklistService } from '@core/services/installation/installation-checklist-service';

const checklistWith = (emailProvider: string, meta: Record<string, string> = {}) => new InstallationChecklistService({
  countThemes: () => 1,
  activeThemeName: () => 'theme',
  countSites: async () => 1,
  countPlugins: () => 1,
  countUsers: async () => 1,
  canStoreSecrets: () => true,
  readMeta: async (key: string) => meta[key] ?? '',
  emailProvider: async () => emailProvider,
  storefrontUrl: () => '',
});

const emailItem = async (service: InstallationChecklistService) =>
  ((await service.read()).missing as Array<Record<string, unknown>>).find((item) => item.key === 'email');

describe('InstallationChecklistService email item', () => {
  it('reports the provider the mailer resolves as configured', async () => {
    expect(await emailItem(checklistWith('SMTP'))).toMatchObject({ done: true, detail: 'Configured · SMTP' });
  });

  it('says nothing can be sent when no provider resolves', async () => {
    expect(await emailItem(checklistWith(''))).toMatchObject({ done: false });
  });

  it('ignores the retired single-provider meta key', async () => {
    const service = checklistWith('', { integration_email_provider: 'smtp' });
    expect(await emailItem(service)).toMatchObject({ done: false });
  });
});

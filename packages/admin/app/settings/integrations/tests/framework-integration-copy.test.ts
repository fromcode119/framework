import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { FrameworkIntegrationCopy } from '@/app/settings/integrations/framework-integration-copy';

const record = (owner: string, dictionary: string) => ({
  key: 'email', label: 'Email Delivery', description: 'Provider used for outbound system and plugin emails.',
  defaultProvider: 'smtp', allowMultipleActiveProviders: false, owner: { slug: owner, label: owner },
  providers: [{
    key: 'smtp', label: 'SMTP', dictionary,
    fields: [
      { name: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.example.com' },
      { name: 'fromName', label: 'From Name', type: 'text', placeholder: 'Shown beside the address; defaults to the platform name' },
    ],
  }],
}) as any;

describe('FrameworkIntegrationCopy', () => {
  afterEach(() => AdminI18n.setLocale('en'));

  it("words the framework's own type, providers and settings in the console's language", () => {
    AdminI18n.setLocale('bg');
    const localized = FrameworkIntegrationCopy.localize(record('', ''));
    expect(localized.label).toBe('Изпращане на имейли');
    const [host, fromName] = localized.providers[0].fields!;
    expect(host).toMatchObject({ label: 'SMTP сървър', placeholder: 'smtp.example.com' });
    expect(fromName.placeholder).toBe('Показва се до адреса; по подразбиране е името на платформата');
  });

  it('leaves what a plugin registered to the api, which words it from that plugin', () => {
    AdminI18n.setLocale('bg');
    const localized = FrameworkIntegrationCopy.localize(record('mailer', 'mailer'));
    expect(localized.label).toBe('Email Delivery');
    expect(localized.providers[0].fields![0].label).toBe('SMTP Host');
  });
});

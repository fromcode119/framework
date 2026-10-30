import { IntegrationSelectors } from '@/app/settings/integrations/integration-selectors';
import { IntegrationProviderFormHelper } from '@/app/settings/integrations/integration-provider-form-helper';

const type = (key: string, slug: string, label = '') => ({
  key, label: key, defaultProvider: '', providers: [], allowMultipleActiveProviders: false, owner: { slug, label },
}) as any;

describe('IntegrationSelectors.ownerTabs', () => {
  it('puts the platform first and each plugin once, in the order its types appear', () => {
    const tabs = IntegrationSelectors.ownerTabs([type('ai', ''), type('courier', 'logistics', 'Logistics'), type('email', ''), type('payout', 'finance', 'Finance'), type('pickup', 'logistics', 'Logistics')]);
    expect(tabs).toEqual([{ slug: '', label: '' }, { slug: 'logistics', label: 'Logistics' }, { slug: 'finance', label: 'Finance' }]);
  });

  it('lists only the chosen owner’s types', () => {
    const all = [type('ai', ''), type('courier', 'logistics'), type('email', '')];
    expect(IntegrationSelectors.typesOfOwner(all, '').map((t) => t.key)).toEqual(['ai', 'email']);
  });
});

describe('IntegrationProviderFormHelper.buildSavePayload', () => {
  const definition = { key: 'smtp', label: 'SMTP', fields: [] } as any;
  const editor = { isNew: false, providerId: 'p1', providerKey: 'smtp', providerName: '', enabled: false, config: {}, preservedSecretFields: {} };

  it('replaces the provider in use for a one-provider type', () => {
    expect(IntegrationProviderFormHelper.buildSavePayload(definition, editor, false)).toMatchObject({ makeActive: true, enabled: true });
  });

  it('keeps a provider’s own on/off when several may be on', () => {
    expect(IntegrationProviderFormHelper.buildSavePayload(definition, editor, true)).toMatchObject({ makeActive: false, enabled: false });
  });
});

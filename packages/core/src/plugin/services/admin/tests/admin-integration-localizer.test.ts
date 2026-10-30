import { describe, expect, it } from 'vitest';
import { AdminSchemaLocalizer } from '@core/plugin/services/admin/admin-schema-localizer';
import { IntegrationRegistry } from '@core/integrations/integration-registry';

/** Settings → Integrations in the console's language: the type from its owner, a provider from the plugin that supplied it. */
describe('AdminSchemaLocalizer.integration', () => {
  const dictionary: Record<string, string> = {
    'carriers.admin.integrations.shipping_provider.label': 'Куриер',
    'carriers.admin.integrations.shipping_provider.description': 'Цени, етикети и проследяване.',
    'courier-plugin.admin.integrations.shipping_provider.providers.acme.label': 'Акме',
    'courier-plugin.admin.integrations.shipping_provider.providers.acme.fields.username.label': 'Потребителско име',
    'courier-plugin.admin.integrations.shipping_provider.providers.acme.fields.username.description': 'Името на профила.',
    'courier-plugin.admin.integrations.shipping_provider.providers.acme.fields.labelFormat.options.pdf': 'PDF файл',
    'carriers.admin.integrations.shipping_provider.providers.acme.fields.username.label': 'грешен речник',
  };
  const localizer = new AdminSchemaLocalizer((plugin, key) => dictionary[`${plugin}.${key}`] || '');

  const summary = () => {
    const registry = new IntegrationRegistry(null);
    registry.registerType({ key: 'shipping_provider', label: 'Shipping Provider', description: 'Carrier integrations.', providers: [] } as any, 'carriers', 'Carriers');
    // The carriers plugin registers the courier plugin's settings on its behalf, naming whose words they are.
    registry.registerProvider('shipping_provider', {
      key: 'acme', label: 'Acme', dictionary: 'courier-plugin', create: () => ({}),
      fields: [
        { name: 'username', label: 'Username', type: 'text', description: 'The account name.' },
        { name: 'labelFormat', label: 'Label format', type: 'select', options: [{ value: 'pdf', label: 'PDF' }, { value: 'zpl', label: 'ZPL' }] },
        { name: 'timeoutMs', label: 'Timeout', type: 'number' },
      ],
    } as any, 'carriers');
    return registry.getTypeSummary('shipping_provider')!;
  };

  it("words the type from its owner and the provider from the plugin that supplied it", () => {
    const localized = localizer.integration(summary());
    expect(localized.label).toBe('Куриер');
    expect(localized.description).toBe('Цени, етикети и проследяване.');
    const [provider] = localized.providers;
    expect(provider.label).toBe('Акме');
    expect(provider.fields?.[0]).toMatchObject({ label: 'Потребителско име', description: 'Името на профила.' });
    expect(provider.fields?.[1].options).toEqual([{ value: 'pdf', label: 'PDF файл' }, { value: 'zpl', label: 'ZPL' }]);
  });

  it('leaves what the dictionary lacks as declared and adds no keys', () => {
    const [provider] = localizer.integration(summary()).providers;
    expect(provider.fields?.[2]).toEqual({ name: 'timeoutMs', label: 'Timeout', type: 'number', description: undefined, placeholder: undefined });
  });

  it("uses the registering plugin's dictionary when the provider names none", () => {
    const registry = new IntegrationRegistry(null);
    registry.registerType({ key: 'shipping_provider', label: 'Shipping Provider', providers: [] } as any, 'carriers');
    registry.registerProvider('shipping_provider', { key: 'acme', label: 'Acme', create: () => ({}), fields: [{ name: 'username', label: 'Username', type: 'text' }] } as any, 'carriers');
    const [provider] = localizer.integration(registry.getTypeSummary('shipping_provider')!).providers;
    expect(provider.dictionary).toBe('carriers');
    expect(provider.fields?.[0].label).toBe('грешен речник');
  });

  it("leaves the framework's own types to the console", () => {
    const registry = new IntegrationRegistry(null);
    registry.registerType({ key: 'email', label: 'Email Delivery', defaultProvider: 'smtp', providers: [{ key: 'smtp', label: 'SMTP', create: () => ({}) }] } as any);
    const localized = localizer.integration(registry.getTypeSummary('email')!);
    expect(localized.label).toBe('Email Delivery');
    expect(localized.providers[0]).toMatchObject({ label: 'SMTP', registeredBy: '', dictionary: '' });
  });
});

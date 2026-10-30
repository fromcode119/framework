import { describe, expect, it } from 'vitest';
import { IntegrationRegistry } from '@core/integrations/integration-registry';

/**
 * The admin groups integration types by who registered them and edits a one-provider type as a single
 * form. Both facts were known to the registry and never reached the summary it hands the admin.
 */
function registry() {
  const db = { async findOne() { return null; }, async find() { return []; }, async insert(_t: string, row: any) { return row; }, async update() { return null; } };
  return new IntegrationRegistry(db as any);
}

const none = { key: 'none', label: 'Not set up', fields: [], create: () => ({}) };

describe('integration type summary', () => {
  it('names the registering plugin, and no one for a framework type', () => {
    const integrations = registry();
    integrations.registerType({ key: 'email', label: 'Email', defaultProvider: 'none', providers: [none] } as any);
    integrations.registerType({ key: 'courier', label: 'Courier', defaultProvider: 'none', providers: [none] } as any, 'logistics', 'Logistics');

    expect(integrations.getTypeSummary('email')?.owner).toEqual({ slug: '', label: '' });
    expect(integrations.getTypeSummary('courier')?.owner).toEqual({ slug: 'logistics', label: 'Logistics' });
    expect(integrations.listTypes().map((type) => type.owner.slug)).toEqual(['', 'logistics']);
  });

  it('falls back to the slug when a plugin gives no name', () => {
    const integrations = registry();
    integrations.registerType({ key: 'courier', label: 'Courier', defaultProvider: 'none', providers: [none] } as any, 'logistics');
    expect(integrations.getTypeSummary('courier')?.owner).toEqual({ slug: 'logistics', label: 'logistics' });
  });

  it('says whether several providers may be active at once', () => {
    const integrations = registry();
    integrations.registerType({ key: 'email', label: 'Email', defaultProvider: 'none', providers: [none] } as any);
    integrations.registerType({ key: 'sso', label: 'Login', defaultProvider: 'none', allowMultipleActiveProviders: true, providers: [none] } as any);
    expect(integrations.getTypeSummary('email')?.allowMultipleActiveProviders).toBe(false);
    expect(integrations.getTypeSummary('sso')?.allowMultipleActiveProviders).toBe(true);
  });
});

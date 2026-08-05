import { describe, expect, it } from 'vitest';
import { PluginSettingsKeyMigrationService } from '@core/plugin/services/plugin-settings-key-migration-service';

/**
 * This replaced eleven near-identical per-plugin migration classes. The behaviour that matters is
 * that it is SCHEMA-DRIVEN: it only ever moves a stored key onto a name the plugin actually
 * declares, so it can never invent or mangle a key nobody asked for.
 */
const schema = {
  fields: [
    { name: 'taxRatePercent' },
    { name: 'taxInclusive' },
    { name: 'invoiceIssuerName' },
  ],
};

describe('PluginSettingsKeyMigrationService.reconcile', () => {
  it('moves a legacy snake_case value onto the declared camelCase name', () => {
    const result = PluginSettingsKeyMigrationService.reconcile(
      { tax_rate_percent: 20, tax_inclusive: true },
      schema,
    );

    expect(result.settings.taxRatePercent).toBe(20);
    expect(result.settings.taxInclusive).toBe(true);
    // `undefined` (not merely absent) is what removes the old key when the object is serialised.
    expect(result.settings).toHaveProperty('tax_rate_percent', undefined);
    expect(result.movedKeys).toHaveLength(2);
  });

  it('never clobbers a value already stored under the declared name', () => {
    const result = PluginSettingsKeyMigrationService.reconcile(
      { tax_rate_percent: 20, taxRatePercent: 9 },
      schema,
    );

    expect(result.settings.taxRatePercent).toBe(9);
  });

  it('leaves undeclared keys completely alone', () => {
    // A free-form key the schema says nothing about is not ours to rename — blind camelCasing here
    // is exactly how a settings blob gets silently reshaped.
    const result = PluginSettingsKeyMigrationService.reconcile(
      { some_free_form_blob: { a: 1 } },
      schema,
    );

    expect(result.settings.some_free_form_blob).toEqual({ a: 1 });
    expect(result.settings).not.toHaveProperty('someFreeFormBlob');
    expect(result.movedKeys).toHaveLength(0);
  });

  it('is a no-op once migrated, so it stops doing work', () => {
    const result = PluginSettingsKeyMigrationService.reconcile(
      { taxRatePercent: 20, taxInclusive: true },
      schema,
    );

    expect(result.movedKeys).toHaveLength(0);
  });

  it('does nothing when the plugin declares no schema fields', () => {
    const result = PluginSettingsKeyMigrationService.reconcile({ tax_rate_percent: 20 }, { fields: [] });

    expect(result.settings.tax_rate_percent).toBe(20);
    expect(result.movedKeys).toHaveLength(0);
  });
});

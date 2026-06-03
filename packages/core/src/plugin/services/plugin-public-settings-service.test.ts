import { describe, expect, it, vi } from 'vitest';
import { PluginPublicSettingsService } from './plugin-public-settings-service';

const PLUGIN = { manifest: { slug: 'ecommerce', namespace: 'org.fromcode' } };

function schemaWith(fields: any[]) {
  return { fields };
}

describe('PluginPublicSettingsService.resolve', () => {
  it('publishes only fields explicitly flagged public: true', async () => {
    // Real storage contract: the `settings` column wraps the values under `.settings`.
    const db = { findOne: vi.fn(async () => ({ settings: { settings: { storeCurrency: 'BGN', secretKey: 'leak' } } })) };
    const getSchema = () => schemaWith([
      { name: 'storeCurrency', type: 'select', defaultValue: 'EUR', public: true },
      { name: 'productPermalinkBase', type: 'text', defaultValue: '/shop' }, // not public
    ]);

    const result = await PluginPublicSettingsService.resolve([PLUGIN], getSchema, db);

    expect(result['org.fromcode/ecommerce']).toEqual({ storeCurrency: 'BGN' });
    expect(result['ecommerce']).toEqual({ storeCurrency: 'BGN' });
    expect(result['org.fromcode/ecommerce']).not.toHaveProperty('productPermalinkBase');
    expect(JSON.stringify(result)).not.toContain('leak');
  });

  it('falls back to defaultValue when nothing is stored', async () => {
    const db = { findOne: vi.fn(async () => null) };
    const getSchema = () => schemaWith([
      { name: 'defaultCheckoutMode', type: 'select', defaultValue: 'direct_buy', public: true },
    ]);

    const result = await PluginPublicSettingsService.resolve([PLUGIN], getSchema, db);

    expect(result['org.fromcode/ecommerce']).toEqual({ defaultCheckoutMode: 'direct_buy' });
  });

  it('NEVER publishes password-typed fields even if flagged public', async () => {
    const db = { findOne: vi.fn(async () => ({ settings: { stripeSecret: 'sk_live_x' } })) };
    const getSchema = () => schemaWith([
      { name: 'stripeSecret', type: 'password', defaultValue: '', public: true },
    ]);

    const result = await PluginPublicSettingsService.resolve([PLUGIN], getSchema, db);

    expect(result['org.fromcode/ecommerce']).toBeUndefined();
  });

  it('NEVER publishes credential-named fields even if flagged public', async () => {
    const db = { findOne: vi.fn(async () => ({ settings: { apiKey: 'k', authToken: 't' } })) };
    const getSchema = () => schemaWith([
      { name: 'apiKey', type: 'text', defaultValue: '', public: true },
      { name: 'authToken', type: 'text', defaultValue: '', public: true },
    ]);

    const result = await PluginPublicSettingsService.resolve([PLUGIN], getSchema, db);

    expect(result['org.fromcode/ecommerce']).toBeUndefined();
  });

  it('unwraps the {config:{settings:{...}}} stored shape', async () => {
    const db = { findOne: vi.fn(async () => ({ settings: JSON.stringify({ settings: { taxRatePercent: 20 } }) })) };
    const getSchema = () => schemaWith([
      { name: 'taxRatePercent', type: 'number', defaultValue: 0, public: true },
    ]);

    const result = await PluginPublicSettingsService.resolve([PLUGIN], getSchema, db);

    expect(result['org.fromcode/ecommerce']).toEqual({ taxRatePercent: 20 });
  });

  it('omits plugins with no public fields and never queries their stored settings', async () => {
    const db = { findOne: vi.fn(async () => ({ settings: {} })) };
    const getSchema = () => schemaWith([{ name: 'internalOnly', type: 'text', defaultValue: '' }]);

    const result = await PluginPublicSettingsService.resolve([PLUGIN], getSchema, db);

    expect(result).toEqual({});
    expect(db.findOne).not.toHaveBeenCalled();
  });
});

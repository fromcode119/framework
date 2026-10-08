import { describe, expect, it } from 'vitest';
import { IntegrationRegistry } from '@core/integrations/integration-registry';
import { IntegrationsContextProxy } from '@core/plugin/context/integrations';
import { SmsContextProxy } from '@core/plugin/context/sms';

/**
 * Registration used to overwrite whatever held the key. A plugin registering a provider under the
 * active email provider's key was handed its decrypted credentials and every password-reset mail from
 * then on; re-registering a core type replaced it wholesale. A plugin may add, and re-register its own,
 * but never replace what the framework or another plugin registered.
 */

const ALLOWED = { hasCapability: () => true, handleViolation: () => {}, handleRateLimit: () => {} } as any;

function setup() {
  const registry = new IntegrationRegistry({}, { info() {}, warn() {}, error() {}, debug() {} } as any);
  // What the framework registers at boot, with no owner.
  registry.registerType({
    key: 'email', label: 'Email', defaultProvider: 'smtp',
    providers: [{ key: 'smtp', label: 'SMTP', fields: [], create: () => ({ owner: 'framework' }) }],
  } as any);
  registry.registerType({ key: 'sms', label: 'SMS', providers: [] } as any);
  const manager = { integrations: registry } as any;
  const pluginContext = (slug: string) => ({
    integrations: IntegrationsContextProxy.createIntegrationsProxy({ manifest: { slug, namespace: 'org.test' } } as any, manager, ALLOWED),
    sms: SmsContextProxy.createSmsProxy({ manifest: { slug, namespace: 'org.test' } } as any, manager),
  });
  return { registry, pluginContext };
}

const provider = (key: string) => ({ key, label: key, fields: [], create: () => ({}) });

describe('integration registration ownership', () => {
  it('refuses a plugin registering over the framework’s email provider', () => {
    const { pluginContext } = setup();

    expect(() => pluginContext('evil').integrations.registerProvider('email', provider('smtp'))).toThrow(/registered by the framework/);
  });

  it('refuses a plugin replacing a framework type wholesale', () => {
    const { pluginContext } = setup();

    expect(() => pluginContext('evil').integrations.registerType({ key: 'email', label: 'Mine', defaultProvider: 'x', providers: [provider('x')] })).toThrow(/integration type "email"/);
  });

  it('lets a plugin add a new provider to a framework type', () => {
    const { pluginContext } = setup();

    expect(() => pluginContext('mailer').integrations.registerProvider('email', provider('sendgrid'))).not.toThrow();
  });

  it('lets a plugin register its own type and re-register it — a hot reload', () => {
    const { pluginContext } = setup();
    const definition = { key: 'payment_gateway', label: 'Payments', defaultProvider: 'card', providers: [provider('card')] };

    pluginContext('finance').integrations.registerType(definition);
    expect(() => pluginContext('finance').integrations.registerType(definition)).not.toThrow();
    expect(() => pluginContext('finance').integrations.registerProvider('payment_gateway', provider('card'))).not.toThrow();
  });

  it('refuses one plugin taking over another plugin’s type or provider', () => {
    const { pluginContext } = setup();
    pluginContext('finance').integrations.registerType({ key: 'payment_gateway', label: 'Payments', defaultProvider: 'card', providers: [provider('card')] });

    expect(() => pluginContext('evil').integrations.registerProvider('payment_gateway', provider('card'))).toThrow(/plugin "finance"/);
    expect(() => pluginContext('evil').integrations.registerType({ key: 'payment_gateway', label: 'x', providers: [] })).toThrow(/plugin "finance"/);
  });

  it('applies to text-message providers too', () => {
    const { pluginContext } = setup();
    const sender = { key: 'twilio', label: 'Twilio', fields: [], send: async () => ({ ok: true }) } as any;

    pluginContext('sms-twilio').sms.registerProvider(sender);
    expect(() => pluginContext('sms-twilio').sms.registerProvider(sender)).not.toThrow();
    expect(() => pluginContext('evil').sms.registerProvider(sender)).toThrow(/plugin "sms-twilio"/);
  });

  it('frees the key once its owner unregisters it', () => {
    const { registry, pluginContext } = setup();
    pluginContext('finance').integrations.registerType({ key: 'payment_gateway', label: 'Payments', defaultProvider: 'card', providers: [provider('card')] });

    registry.unregisterType('payment_gateway');

    expect(() => pluginContext('other').integrations.registerType({ key: 'payment_gateway', label: 'x', providers: [] })).not.toThrow();
  });
});

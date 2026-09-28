import { afterEach, describe, expect, it } from 'vitest';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { TenantPluginRuntimePolicy } from '@core/plugin/tenant/tenant-plugin-runtime-policy';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';

describe('site plugin runtime allowlist', () => {
  afterEach(() => PluginOwners.forget('local-probe'));

  it('refuses platform services, schema roots, and cross-site iteration', () => {
    PluginOwners.record('local-probe', 'site-a');
    const targets = [
      ['context', 'migrations', 'run'],
      ['context', 'catalog', 'contribute'],
      ['context', 'meta', 'set'],
      ['context', 'notifications', 'notifyAdmins'],
      ['context', 'tenants', 'forEach'],
      ['context', 'users', 'list'],
      ['context', 'roles', 'assignRole'],
      ['context', 'signing', 'sign'],
      ['context', 'secrets', 'decrypt'],
      ['context', 'media', 'list'],
      ['context', 'collections', 'register'],
      ['context', 'db', 'find'],
      ['context', 'auth', 'generateToken'],
      ['ddl', 'createTable', ''],
      ['core', 'defaultPageContracts', 'list'],
    ];

    for (const [root, surface, method] of targets) {
      expect(() => TenantPluginRuntimePolicy.assertRemoteCall('local-probe', {
        root,
        steps: [{ name: surface }, ...(method ? [{ name: method, args: [] }] : [])],
      })).toThrow(/site-uploaded plugin/);
    }
  });

  it('allows only site-scoped runtime calls used by the approved capabilities', () => {
    PluginOwners.record('local-probe', 'site-a');
    for (const [surface, method] of [
      ['hooks', 'emit'], ['cache', 'set'], ['i18n', 'siteClock'], ['paths', 'readCurrentPluginText'],
      ['settings', 'get'], ['tenants', 'current'], ['theme', 'getActiveSlug'], ['auth', 'verifyToken'],
    ]) {
      expect(() => TenantPluginRuntimePolicy.assertRemoteCall('local-probe', {
        root: 'context', steps: [{ name: surface }, { name: method, args: [] }],
      })).not.toThrow();
    }
  });

  it('allows only a direct surface.method call — no deeper walk, property read, or call on the surface', () => {
    PluginOwners.record('local-probe', 'site-a');
    const refused = [
      [{ name: 'settings' }, { name: 'get', args: [] }, { name: 'constructor' }],
      [{ name: 'tenants' }, { name: 'current' }],
      [{ name: 'cache', args: [] }, { name: 'get', args: ['k'] }],
      [{ name: 'hooks' }],
    ];
    for (const steps of refused) {
      expect(() => TenantPluginRuntimePolicy.assertRemoteCall('local-probe', { root: 'context', steps }))
        .toThrow(/site-uploaded plugin/);
    }
  });

  it('refuses registrations that escape one site', () => {
    PluginOwners.record('local-probe', 'site-a');
    for (const kind of [
      PluginGuestRegistrationKind.TENANTS_FOR_EACH,
      PluginGuestRegistrationKind.PLUGINS_ON,
      PluginGuestRegistrationKind.SCHEDULER,
      PluginGuestRegistrationKind.JOB_WORKER,
      PluginGuestRegistrationKind.MCP_TOOLS,
      PluginGuestRegistrationKind.GATE,
      PluginGuestRegistrationKind.CANONICAL_PATH,
    ]) {
      expect(() => TenantPluginRuntimePolicy.assertRegistration('local-probe', { kind: String(kind.value) }))
        .toThrow(/site-uploaded plugin/);
    }
  });

  it('allows route, hook, and scoped schema declarations only', () => {
    PluginOwners.record('local-probe', 'site-a');
    for (const kind of [PluginGuestRegistrationKind.ROUTE, PluginGuestRegistrationKind.HOOK]) {
      expect(() => TenantPluginRuntimePolicy.assertRegistration('local-probe', { kind: String(kind.value) })).not.toThrow();
    }
    expect(() => TenantPluginRuntimePolicy.assertRegistration('local-probe', {
      kind: String(PluginGuestRegistrationKind.DECLARATION.value),
      steps: [{ name: 'i18n' }, { name: 'registerTranslations', args: ['en', {}] }],
    })).not.toThrow();
    expect(() => TenantPluginRuntimePolicy.assertRegistration('local-probe', {
      kind: String(PluginGuestRegistrationKind.DECLARATION.value),
      steps: [{ name: 'collections' }, { name: 'register', args: [{}] }],
    })).toThrow(/site-uploaded plugin/);
  });

  it('does not restrict a platform-installed plugin', () => {
    expect(() => TenantPluginRuntimePolicy.assertRemoteCall('local-probe', {
      root: 'ddl', steps: [{ name: 'execute', args: [] }],
    })).not.toThrow();
  });
});

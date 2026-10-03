import { describe, expect, it } from 'vitest';
import { PluginNetworkDeclaration } from '@core/plugin/consent/plugin-network-declaration';
import { PluginConsentSet } from '@core/plugin/consent/plugin-consent-set';
import { PluginConsentSummary } from '@core/plugin/consent/plugin-consent-summary';
import { PluginApprovalCoverage } from '@core/plugin/consent/plugin-approval-coverage';
import { PublicNetworkFetch } from '@core/security/public-network-fetch';

const manifest = (extra: Record<string, unknown> = {}) =>
  ({ slug: 'courier', name: 'Courier', version: '1.0.0', capabilities: ['network', 'hooks'], ...extra }) as any;

describe('the hosts a plugin declares', () => {
  it('are normalized, and entries that are not host names are reported rather than used', () => {
    const declared = manifest({ network: { hosts: ['EE.courier.example', ' demo.courier.example ', 'ee.courier.example', 'http://evil', '*.courier.example'] } });

    expect(PluginNetworkDeclaration.hosts(declared)).toEqual(['*.courier.example', 'demo.courier.example', 'ee.courier.example']);
    expect(PluginNetworkDeclaration.invalidHosts(declared)).toEqual(['http://evil']);
  });

  it('let a request through only to a host that is declared AND approved', () => {
    const declared = manifest({ network: { hosts: ['api.payments.example', '*.courier.example'] } });
    const approved = ['network', 'network:host:api.payments.example'];

    expect(PluginNetworkDeclaration.permits(declared, approved, 'api.payments.example')).toBe(true);
    expect(PluginNetworkDeclaration.permits(declared, approved, 'ee.courier.example')).toBe(false);
    expect(PluginNetworkDeclaration.permits(declared, [...approved, 'network:host:*.courier.example'], 'ee.courier.example')).toBe(true);
    expect(PluginNetworkDeclaration.permits(declared, [...approved, 'network:host:*.courier.example'], 'courier.example')).toBe(false);
    expect(PluginNetworkDeclaration.permits(declared, approved, 'collect.elsewhere.example')).toBe(false);
  });

  it('treat a plugin that names no hosts as reaching any host, allowed only once that is approved', () => {
    expect(PluginConsentSet.of(manifest())).toEqual(['hooks', 'network', 'network:any']);
    expect(PluginNetworkDeclaration.permits(manifest(), ['network'], 'api.payments.example')).toBe(false);
    expect(PluginNetworkDeclaration.permits(manifest(), ['network', 'network:any'], 'api.payments.example')).toBe(true);
    expect(PluginNetworkDeclaration.permits(manifest({ network: { hosts: [] } }), ['network', 'network:any'], 'api.payments.example')).toBe(false);
    const any = manifest({ network: { any: true, reason: 'Sends each submission to the webhook URL you set.' } });
    expect(PluginNetworkDeclaration.permits(any, ['network'], 'hooks.elsewhere.example')).toBe(false);
    expect(PluginNetworkDeclaration.permits(any, ['network', 'network:any'], 'hooks.elsewhere.example')).toBe(true);
  });

  it('stop a redirect that leaves the approved hosts, at every hop', () => {
    const allow = (host: string) => host === 'api.payments.example';

    expect(() => PublicNetworkFetch.assertTarget('https://api.payments.example/v1/charges', allow)).not.toThrow();
    expect(() => PublicNetworkFetch.assertTarget('https://collect.elsewhere.example/?card=4242', allow)).toThrow(/not a host this plugin was approved/);
  });
});

describe('what an operator approves', () => {
  it('is every capability plus, with network, every declared host', () => {
    expect(PluginConsentSet.of(manifest({ network: { hosts: ['api.payments.example'] } }))).toEqual(['hooks', 'network', 'network:host:api.payments.example']);
    expect(PluginConsentSet.of({ ...manifest(), capabilities: ['hooks'], network: { hosts: ['api.payments.example'] } })).toEqual(['hooks']);
  });

  it('must be sent back exactly — order does not matter, anything more or less does', () => {
    const declared = manifest({ network: { hosts: ['api.payments.example'] } });

    expect(PluginConsentSet.matches(declared, ['network:host:api.payments.example', 'network', 'hooks'])).toBe(true);
    expect(PluginConsentSet.matches(declared, ['network', 'hooks'])).toBe(false);
    expect(PluginConsentSet.matches(declared, ['network', 'hooks', 'network:host:api.payments.example', 'email'])).toBe(false);
  });

  it('a plugin is covered only while its approval holds everything it asks for', () => {
    const declared = manifest({ network: { hosts: ['api.payments.example'] } });

    expect(PluginApprovalCoverage.covers({ manifest: declared, approvedCapabilities: ['hooks', 'network'] })).toBe(false);
    expect(PluginApprovalCoverage.covers({ manifest: declared, approvedCapabilities: ['hooks', 'network', 'network:host:api.payments.example'] })).toBe(true);
    expect(PluginApprovalCoverage.covers({ manifest: declared })).toBe(false);
  });
});

describe('narrowing from any host to named hosts', () => {
  it('is covered by the old approval, reaches the named host, and marks nothing new', () => {
    const narrowed = manifest({ network: { hosts: ['api.payments.example'] } });
    const approved = ['hooks', 'network', 'network:any'];

    expect(PluginConsentSet.covers(narrowed, approved)).toBe(true);
    expect(PluginNetworkDeclaration.permits(narrowed, approved, 'api.payments.example')).toBe(true);
    expect(PluginNetworkDeclaration.permits(narrowed, approved, 'collect.elsewhere.example')).toBe(false);
    expect(PluginConsentSummary.of(narrowed, approved).requiresApproval).toBe(false);
  });
});

describe('the consent summary', () => {
  it('ranks the riskiest first, marks what is new and names what was dropped', () => {
    const declared = manifest({ capabilities: ['network', 'hooks', 'database:raw', 'i18n'], network: { any: true, reason: 'Webhooks.' } });

    const summary = PluginConsentSummary.of(declared, ['hooks', 'i18n', 'email']);

    expect(summary.entries.map((entry) => [entry.entry, entry.risk, entry.isNew])).toEqual([
      ['database:raw', 'high', true],
      ['network:any', 'high', true],
      ['hooks', 'medium', false],
      ['network', 'medium', true],
      ['i18n', 'low', false],
    ]);
    expect(summary.requiresApproval).toBe(true);
    expect(summary.dropped).toEqual(['email']);
    expect(summary.anyHostReason).toBe('Webhooks.');
  });
});

import { describe, expect, it } from 'vitest';
import { PluginDefinitionFacts } from '@/app/plugins/[slug]/plugin-definition-facts';

const plugin = (manifest: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ manifest: { slug: 'demo', name: 'Demo', version: '1.0.0', category: 'tools', ...manifest }, state: 'active', ...extra }) as never;

describe('PluginDefinitionFacts', () => {
  it('lists only what the manifest declares', () => {
    const keys = PluginDefinitionFacts.identity(plugin({ namespace: 'org.example' })).map((fact) => fact.key);
    expect(keys).toEqual(['name', 'vendor', 'slug', 'version', 'category']);
  });

  it('reads an author written as a name or as an object', () => {
    expect(PluginDefinitionFacts.identity(plugin({ author: 'Ada' })).find((fact) => fact.key === 'author')?.value).toBe('Ada');
    expect(PluginDefinitionFacts.identity(plugin({ author: { name: 'Grace', email: 'g@example.com' } })).find((fact) => fact.key === 'author')?.value).toBe('Grace');
  });

  it('puts the long values on their own row', () => {
    const facts = PluginDefinitionFacts.identity(plugin({ description: 'A long sentence.', homepage: 'https://example.com' }));
    expect(facts.find((fact) => fact.key === 'description')?.wide).toBe(true);
    expect(facts.find((fact) => fact.key === 'version')?.wide).toBe(false);
  });

  it('lists the public addresses, the hosts it may call and what it needs', () => {
    const facts = PluginDefinitionFacts.reach(plugin({
      ui: { publicRoutes: [{ path: '.well-known/security.txt', targetPath: 'security.txt' }] },
      network: { hosts: ['api.example.com', '*.cdn.example.com'] },
      dependencies: { finance: '^0.1.3' },
    }));
    expect(facts.map((fact) => fact.value)).toEqual(['/.well-known/security.txt', 'api.example.com, *.cdn.example.com', 'finance ^0.1.3']);
  });

  it('says "any host" when the manifest asks for every host', () => {
    expect(PluginDefinitionFacts.reach(plugin({ network: { any: true, reason: 'webhooks' } })).map((fact) => fact.key)).toEqual(['hosts']);
  });

  it('shows nothing under "reach" for a plugin that declares nothing there', () => {
    expect(PluginDefinitionFacts.reach(plugin({}))).toEqual([]);
  });

  it('marks which declared capabilities are approved', () => {
    expect(PluginDefinitionFacts.capabilities(plugin({ capabilities: ['database', 'api'] }, { approvedCapabilities: ['database'] })))
      .toEqual([{ name: 'database', approved: true }, { name: 'api', approved: false }]);
  });
});

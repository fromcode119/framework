import { describe, expect, it } from 'vitest';
import { TenantKindPresets } from '@core/tenant/provisioning/tenant-kind-presets';
import { AppearanceWorkspaceDeclarationReader } from '@core/appearance/appearance-workspace-declaration-reader';

describe('TenantKindPresets', () => {
  const appearances = [
    { slug: 'default', name: 'Default', version: '', builtIn: true },
    { slug: 'plain', name: 'Plain', version: '1', builtIn: false },
    { slug: 'acme', name: 'Acme console', version: '1', builtIn: false, workspace: { label: 'Acme — ops', description: 'Ops.', plugins: ['alpha', 'beta'] } },
    { slug: 'zed', name: 'Zed', version: '1', builtIn: false, workspace: { plugins: ['gamma'] } },
  ];

  it('offers one preset per appearance that declares a workspace, locked to that appearance', () => {
    const presets = TenantKindPresets.fromAppearances(appearances);
    expect(presets.map((p) => p.id)).toEqual(['acme', 'zed']);
    expect(presets[0].toJSON()).toEqual({ id: 'acme', label: 'Acme — ops', description: 'Ops.', plugins: ['alpha', 'beta'], appearance: 'acme' });
    expect(presets[1].label).toBe('Zed');
    expect(TenantKindPresets.find(presets, ' ZED ')?.appearance).toBe('zed');
    expect(TenantKindPresets.find(presets, 'plain')).toBeUndefined();
  });

  it('reads the manifest block defensively: missing → undefined, slugs normalized and deduped', () => {
    expect(AppearanceWorkspaceDeclarationReader.read({ slug: 'x' })).toBeUndefined();
    expect(AppearanceWorkspaceDeclarationReader.read({ workspace: { plugins: [' Alpha', 'alpha', ''] } })).toEqual({ label: undefined, description: undefined, plugins: ['alpha'] });
  });
});

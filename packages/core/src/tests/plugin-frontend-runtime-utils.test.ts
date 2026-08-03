import { describe, expect, it } from 'vitest';
import { PluginFrontendRuntimeUtils } from '@core/plugin-frontend-runtime-utils';

describe('PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime', () => {
  it('is true for a plugin shipping a frontend entry (ecommerce) — it registers its own client', () => {
    expect(PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime({
      slug: 'ecommerce',
      ui: { entry: 'bundle.js', frontendEntry: 'frontend.js' },
      capabilities: ['database', 'api', 'admin', 'frontend', 'i18n'],
    })).toBe(true);
  });

  it('is true for a deferred (idle) frontend runtime — it still registers its own client, just later', () => {
    expect(PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime({
      slug: 'mlm',
      ui: { entry: 'bundle.js', frontendEntry: 'frontend.js', loadStrategy: 'idle' },
      capabilities: ['api', 'admin', 'frontend'],
    })).toBe(true);
  });

  it('is false when the capability list omits `frontend` (numerology) — storefront never loads it', () => {
    expect(PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime({
      slug: 'numerology',
      ui: { entry: 'bundle.js' },
      capabilities: ['api', 'database', 'admin', 'hooks', 'i18n'],
    })).toBe(false);
  });

  it('is false when the runtime is opted out via loadStrategy `none`', () => {
    expect(PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime({
      slug: 'opted-out',
      ui: { entry: 'bundle.js', frontendEntry: 'frontend.js', loadStrategy: 'none' },
      capabilities: ['frontend'],
    })).toBe(false);
  });

  it('is false when the plugin ships no ui entry at all', () => {
    expect(PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime({ slug: 'backend-only', capabilities: ['api'] })).toBe(false);
  });

  it('is true when an entry exists and no capability list constrains it (defaults to eager)', () => {
    expect(PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime({ slug: 'legacy', ui: { entry: 'bundle.js' } })).toBe(true);
  });

  it('tolerates absent/!object descriptors rather than throwing', () => {
    expect(PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime(null)).toBe(false);
    expect(PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime(undefined)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import * as ReactIndex from '@react/index';
import { BridgeObjectBuilder } from '@react/helpers/bridge-object-builder';

/**
 * A theme bundle reads its SDK classes off `window.__fromcodeRuntimeModules['@fromcode119/react']`, which
 * is the bridge object built here. A class exported from the package index but absent from the bridge is
 * `undefined` in the browser: the theme's bundle throws "Class extends value undefined" while its server
 * render looks fine. The theme runtime shipped in the index without being on the bridge; this pins it.
 */
describe('the theme runtime on the runtime bridge', () => {
  const bridge = BridgeObjectBuilder.build({} as never);
  const THEME_RUNTIME = ['ThemeRuntimeContext', 'ThemeComponent', 'ThemeProvider', 'ThemeLayoutShell', 'ThemeEditorSession', 'NullPluginsFacade'];

  it.each(THEME_RUNTIME)('exposes %s, and it is the same class the package exports', (name) => {
    expect(bridge[name], name).toBeDefined();
    expect(bridge[name]).toBe((ReactIndex as Record<string, unknown>)[name]);
  });

  it('exposes what a theme needs to extend, as classes', () => {
    expect(typeof bridge.ThemeComponent).toBe('function');
    expect(typeof bridge.ThemeLayoutShell).toBe('function');
  });
});

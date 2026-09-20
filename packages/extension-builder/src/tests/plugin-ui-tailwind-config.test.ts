import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginUiTailwindConfig } from '@fromcode119/sdk/tailwind/plugin-ui-tailwind-config';

/**
 * The config every plugin's stylesheet is built from, and the one thing about it that has actually
 * broken.
 *
 * It reads the ADMIN's config to inherit the theme, by a path that used to carry a hardcoded `.js`.
 * When that file became TypeScript the path resolved to nothing, so `PluginStyleCompiler` handed
 * tailwind a config that threw — and the build reported "tailwind exited 1" followed by an unrelated
 * first line of stderr, naming neither the file nor the rename. Every plugin packed after that
 * shipped without its stylesheet, and nothing failed until someone looked.
 *
 * Lives here rather than beside the class because this is the suite that already covers the build
 * steps; `packages/sdk` has no test project of its own.
 */
describe('PluginUiTailwindConfig', () => {
  const previous = process.env.PLUGIN_UI_DIR;

  beforeEach(() => { process.env.PLUGIN_UI_DIR = __dirname; });
  afterEach(() => { if (previous === undefined) delete process.env.PLUGIN_UI_DIR; else process.env.PLUGIN_UI_DIR = previous; });

  it('loads the admin config, whatever extension that file has', () => {
    // `theme` and `darkMode` come from the admin's config: a config that failed to load cannot
    // produce them, so this is exactly what a rename of that file breaks.
    const config = PluginUiTailwindConfig.create() as Record<string, any>;
    expect(config.theme).toBeTruthy();
    expect(config.darkMode).toBeTruthy();
  });

  it('scans the directory it was pointed at', () => {
    const config = PluginUiTailwindConfig.create() as Record<string, any>;
    expect(JSON.stringify(config.content)).toContain(__dirname);
  });

  it('refuses without PLUGIN_UI_DIR rather than quietly compiling nothing', () => {
    delete process.env.PLUGIN_UI_DIR;
    expect(() => PluginUiTailwindConfig.create()).toThrow(/PLUGIN_UI_DIR is required/);
  });
});

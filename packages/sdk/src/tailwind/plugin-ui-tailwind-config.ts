import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { PluginPackageLayout } from '@fromcode119/core';

/**
 * Tailwind config for ONE plugin's admin UI. `PLUGIN_UI_DIR` selects which plugin.
 *
 * A plugin's admin components render inside the admin, so their utilities have to exist in CSS the
 * admin has loaded. The admin's own build cannot supply them: plugins are installed at RUNTIME from
 * tarballs, so the plugin set is not knowable when the admin image is built, and the plugins
 * directory is not even in that image's build context. Scanning plugin sources from the admin only
 * ever worked in a checkout that happened to sit beside them.
 *
 * So each plugin compiles its own utilities at pack time into `ui/style.css`, ships it in the
 * tarball, and the admin loads it at runtime via the manifest's `ui.adminCss`. Any instance then
 * styles whatever plugins it actually has, with no framework rebuild.
 *
 * Authored as a CLASS, like every other build config here: next-build-codegen's `ViteConfigEntryGenerator`
 * writes the entry the tool is actually pointed at, and that generated file is gitignored. Tailwind
 * loads it through jiti, so the entry stays TypeScript — no hand-written `.cjs` in the framework.
 */
export class PluginUiTailwindConfig {
  /** The admin's config, whose THEME this inherits so `bg-primary` means the same in both. */
  private static readonly ADMIN_CONFIG = path.join('..', '..', '..', 'admin', 'tailwind.config.js');

  /**
   * Build output that lives beside the sources; scanning it re-finds the same classes.
   *
   * DERIVED, not listed. The literal list here named `tracker.js` — one plugin's domain concept,
   * in a framework build config that has no idea what tracking is. The framework's own artifacts
   * come from the layout class, and a plugin's extra scripts come from what that plugin DECLARED.
   */
  private static buildOutput(uiDir: string): string[] {
    const declared = PluginPackageLayout.browserEntries(PluginUiTailwindConfig.readPluginManifest(uiDir));
    return [
      PluginPackageLayout.UI_ENTRY,
      PluginPackageLayout.FRONTEND_ENTRY,
      PluginPackageLayout.GENERATED_UI_ENTRY,
      ...declared.map((name) => `${name}.js`),
    ];
  }

  /**
   * The plugin's manifest, found by walking up from the UI dir — `<plugin>/src/ui` and the legacy
   * `<plugin>/ui` are both one or two levels down. Returns `{}` when there is none, so a missing
   * manifest costs the plugin its declared exclusions and nothing else.
   */
  private static readPluginManifest(uiDir: string): Record<string, unknown> {
    let dir = path.resolve(uiDir);
    for (let depth = 0; depth < 3; depth += 1) {
      const candidate = path.join(dir, 'manifest.json');
      try {
        return JSON.parse(fs.readFileSync(candidate, 'utf8'));
      } catch {
        dir = path.dirname(dir);
      }
    }
    return {};
  }

  static create(): Record<string, unknown> {
    const uiDir = String(process.env.PLUGIN_UI_DIR || '').trim();
    if (!uiDir) {
      throw new Error('PLUGIN_UI_DIR is required — it names the plugin UI directory to compile.');
    }

    const admin = PluginUiTailwindConfig.adminConfig();

    return {
      darkMode: admin.darkMode,
      theme: admin.theme,
      plugins: admin.plugins,
      // Preflight is the admin's to emit, once — a second reset from a plugin's stylesheet would
      // restyle the admin's own chrome. The input CSS omits `@tailwind base` for the same reason.
      corePlugins: { preflight: false },
      // `content` is deliberately NOT inherited: presets merge content arrays, and inheriting the
      // admin's would compile the admin's own pages into every plugin's stylesheet.
      content: [
        path.join(uiDir, '**/*.{ts,tsx,js,jsx,mdx}'),
        `!${path.join(uiDir, '**/*.d.ts')}`,
        `!${path.join(uiDir, '**/*.map')}`,
        ...PluginUiTailwindConfig.buildOutput(uiDir).map((file) => `!${path.join(uiDir, file)}`),
      ],
    };
  }

  /**
   * The admin's config is CommonJS (`module.exports`) because Next.js requires it in that shape, so
   * it is read through `createRequire` rather than imported. Anchored on `__filename`, not
   * `import.meta.url`: this file is compiled to CommonJS by the SDK build (where `import.meta` is a
   * hard TS1343 error and broke the admin image) and is also loaded by Tailwind through jiti —
   * `__filename` exists in both.
   */
  private static adminConfig(): Record<string, any> {
    const require_ = createRequire(__filename);
    return require_(PluginUiTailwindConfig.ADMIN_CONFIG) as Record<string, any>;
  }
}

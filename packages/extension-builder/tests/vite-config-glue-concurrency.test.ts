import { describe, expect, it, beforeEach } from 'vitest';
import { ViteConfigGlue } from '@extension-builder/deps/vite-config-glue';

/**
 * The generated tailwind/vite entries are ONE directory shared by every build in this process, and
 * builds overlap — the per-source Build button is not serialised.
 *
 * Two plugins built seconds apart both failed with
 * `tailwind exited 9 — Specified config file /app/data/.fromcode-config/plugin-ui.config.ts does not
 * exist`, then succeeded on retry: the first build to finish ran `remove()` in its `finally` and
 * deleted the configs the second was still using.
 */
describe('ViteConfigGlue', () => {
  beforeEach(() => { (ViteConfigGlue as any).active = 0; });

  it('does not clean up while another build is still running', () => {
    (ViteConfigGlue as any).active = 2;

    ViteConfigGlue.remove();

    // Still one build in flight — the entries must survive.
    expect((ViteConfigGlue as any).active).toBe(1);
  });

  it('never drops below zero, so an unmatched remove cannot arm a premature cleanup', () => {
    ViteConfigGlue.remove();
    ViteConfigGlue.remove();

    expect((ViteConfigGlue as any).active).toBe(0);
  });

  it('gives the two plugin-ui configs different filenames', () => {
    const vite = ViteConfigGlue.generatedPath('packages/sdk/src/vite/plugin-ui.config.ts');
    const tailwind = ViteConfigGlue.generatedPath('packages/sdk/src/tailwind/plugin-ui.config.ts');

    // They share a basename; a flat directory held four files for five entries and the two
    // overwrote each other, so whichever generated last silently won.
    expect(vite).not.toBe(tailwind);
    expect(vite).toMatch(/vite-plugin-ui\.config\.ts$/);
    expect(tailwind).toMatch(/tailwind-plugin-ui\.config\.ts$/);
  });

  it('keeps every entry distinct', () => {
    const names = (ViteConfigGlue as any).ENTRIES.map(([, , outFile]: [string, string, string]) =>
      ViteConfigGlue.generatedPath(outFile));

    expect(new Set(names).size).toBe(names.length);
  });
});

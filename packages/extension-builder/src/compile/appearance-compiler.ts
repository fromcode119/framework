import * as fs from 'fs';
import * as path from 'path';
import { BuildStepResult } from '@extension-builder/build-step-result';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';

/**
 * Compiles an admin appearance: `appearance/<slug>/index.ts` -> `dist/bundle.js`.
 *
 * The last thing still built by a shell script. `build-plugins.sh` went when this package could
 * produce byte-identical artifacts for plugins and themes; appearances were left behind and the
 * pipeline said so — "not ported yet — use build-plugins.sh" — which kept pointing at that script
 * for weeks after it was deleted.
 *
 * Importing the bundle RUNS the entry, which registers the appearance into the live engine, so the
 * output is ESM with react and the SDK externalised: the admin resolves those at runtime through its
 * own import map, and a bundled copy would be a second React in the page.
 */
export class AppearanceCompiler {
  static readonly STEP = 'appearance-compiler';

  /** The entry is the contract: a directory without one is not an appearance. */
  private static readonly ENTRY = 'index.ts';

  private static readonly BUNDLE = path.join('dist', 'bundle.js');

  private static readonly STYLES_SOURCE = 'styles.less';

  private static readonly STYLES_ARTIFACT = path.join('dist', 'appearance.css');

  /** An appearance's own images. `dist/` is the ONLY directory the admin's asset route serves. */
  private static readonly ASSETS = 'assets';

  /**
   * Resolved at runtime by the admin, never bundled.
   *
   * React twice in one page is two hook dispatchers and a blank screen; the SDK twice is two copies
   * of every registry, so an appearance would register itself into one the admin does not read.
   */
  private static readonly EXTERNAL = [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'lucide-react',
    '@fromcode119/react',
    '@fromcode119/react-class-components',
    '@fromcode119/admin',
    '@fromcode119/admin/components',
    '@fromcode119/sdk',
    '@fromcode119/sdk/react',
    '@fromcode119/sdk/admin',
  ];

  static async compile(appearanceDir: string): Promise<BuildStepResult> {
    const entry = path.join(appearanceDir, AppearanceCompiler.ENTRY);
    if (!fs.existsSync(entry)) {
      return BuildStepResult.skipped(AppearanceCompiler.STEP, `no ${AppearanceCompiler.ENTRY}`);
    }

    const outfile = path.join(appearanceDir, AppearanceCompiler.BUNDLE);
    fs.mkdirSync(path.dirname(outfile), { recursive: true });

    try {
      const esbuild = new BuildToolchain().loadEsbuild();
      await esbuild.build({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        jsx: 'automatic',
        // An appearance renders admin components, whose decorators need legacy semantics and
        // assignment-style class fields — without both, `@state`/`@prop` accessors are clobbered
        // and every appearance renders with empty props.
        tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
        loader: { '.svg': 'text' },
        external: AppearanceCompiler.EXTERNAL,
        outfile,
      });
    } catch (error) {
      return BuildStepResult.failure(AppearanceCompiler.STEP, String((error as Error)?.message || error));
    }

    AppearanceCompiler.copyAssets(appearanceDir);
    return AppearanceCompiler.compileStyles(appearanceDir);
  }

  /** Copied verbatim, so an appearance ships its own brand instead of reaching into a theme. */
  private static copyAssets(appearanceDir: string): void {
    const assets = path.join(appearanceDir, AppearanceCompiler.ASSETS);
    if (!fs.existsSync(assets)) return;
    fs.cpSync(assets, path.join(appearanceDir, 'dist'), { recursive: true });
  }

  private static async compileStyles(appearanceDir: string): Promise<BuildStepResult> {
    const source = path.join(appearanceDir, AppearanceCompiler.STYLES_SOURCE);
    if (!fs.existsSync(source)) return BuildStepResult.ok(AppearanceCompiler.STEP);

    try {
      const less = new BuildToolchain().loadLess();
      const rendered = await less.render(fs.readFileSync(source, 'utf8'), { filename: source });
      fs.writeFileSync(path.join(appearanceDir, AppearanceCompiler.STYLES_ARTIFACT), rendered.css);
    } catch (error) {
      return BuildStepResult.failure(AppearanceCompiler.STEP, String((error as Error)?.message || error));
    }

    return BuildStepResult.ok(AppearanceCompiler.STEP);
  }
}

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { BuildStepResult } from '@extension-builder/build-step-result';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';

/** Minifies the built JS in a served `ui/` dir with terser. */
export class AssetMinifier {
  static readonly STEP = 'asset-minifier';

  /** A fragment unique to the browser require shim, used to tell whether minification ate it. */
  static readonly SHIM_MARKER = 'Dynamic require of ';

  static minify(dir: string, toolchainRoot: string | null): BuildStepResult {
    if (!fs.existsSync(dir)) return BuildStepResult.skipped(AssetMinifier.STEP, `no ${dir}`);

    // Resolve terser ONCE. `npx --yes terser` per file cost ~1.4s of resolve overhead each — about
    // 2.5 silent minutes across a theme's ~100 chunks, which looked exactly like a hung build.
    if (!toolchainRoot) {
      return BuildStepResult.skipped(AssetMinifier.STEP, "terser is not installed on any root above this extension");
    }
    const binary = path.join(toolchainRoot, 'node_modules', '.bin', 'terser');
    if (!fs.existsSync(binary)) {
      return BuildStepResult.skipped(AssetMinifier.STEP, `terser is not installed under ${toolchainRoot}; serving vite output as-is`);
    }

    const files = fs.readdirSync(dir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => path.join(dir, name))
      .filter((file) => fs.statSync(file).isFile());
    if (files.length === 0) return BuildStepResult.skipped(AssetMinifier.STEP, 'no .js files');

    const kept: string[] = [];
    for (const file of files) {
      const temporary = `${file}.min.tmp`;
      const hadShim = fs.readFileSync(file, 'utf8').includes(AssetMinifier.SHIM_MARKER);
      const result = spawnSync(binary, [
        file, '--module',
        '--compress', 'drop_console=true,drop_debugger=true',
        '--mangle', '--format', 'comments=false',
        '-o', temporary,
      ]);

      // A file terser cannot parse is KEPT unminified. Losing it would be far worse than shipping
      // it large, and the temp file must never survive either outcome.
      if (result.status === 0 && fs.existsSync(temporary)) {
        // terser runs with `--module`, so a top-level `var require` is a module-scoped binding it
        // considers unused and DROPS. That binding is the browser require shim, and without it the
        // bundle throws "Dynamic require of react is not supported" and not one component
        // registers. Put it back rather than weakening the minifier: the shim must survive by
        // construction, not by hoping a flag combination happens to spare it.
        const minified = fs.readFileSync(temporary, 'utf8');
        const lostShim = hadShim && !minified.includes(AssetMinifier.SHIM_MARKER);
        fs.writeFileSync(file, lostShim ? `${BuildToolchain.BROWSER_REQUIRE_SHIM}${minified}` : minified);
        fs.rmSync(temporary, { force: true });
      } else {
        fs.rmSync(temporary, { force: true });
        kept.push(path.basename(file));
      }
    }

    if (kept.length > 0) {
      return BuildStepResult.skipped(AssetMinifier.STEP, `terser could not parse ${kept.join(', ')}; kept unminified`);
    }
    return BuildStepResult.ok(AssetMinifier.STEP);
  }
}

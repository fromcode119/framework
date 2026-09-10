import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import * as os from 'os';
import { BuildStepResult } from '@extension-builder/build-step-result';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';

/** Minifies the built JS in a served `ui/` dir with terser. */
export class AssetMinifier {
  static readonly STEP = 'asset-minifier';

  /** A fragment unique to the browser require shim, used to tell whether minification ate it. */
  static readonly SHIM_MARKER = 'Dynamic require of ';

  /** Terser is CPU-bound; more workers than cores only adds scheduling. */
  private static readonly MAX_WORKERS = 4;

  /**
   * Chunks are minified CONCURRENTLY — each file is independent, and a theme has dozens of them.
   *
   * `build-plugins.sh` used `xargs -P 4` here, and a sequential port measured 12% slower on a
   * 31-chunk theme at 116% CPU against the script's 158%. Concurrency is capped rather than
   * unbounded: terser is CPU-bound, so more workers than cores only adds scheduling.
   */
  static async minify(dir: string, toolchainRoot: string | null): Promise<BuildStepResult> {
    if (!fs.existsSync(dir)) return BuildStepResult.skipped(AssetMinifier.STEP, `no ${dir}`);
    if (!toolchainRoot) {
      return BuildStepResult.skipped(AssetMinifier.STEP, 'terser is not installed on any root above this extension');
    }

    // Resolve terser ONCE. `npx --yes terser` per file cost ~1.4s of resolve overhead each — about
    // 2.5 silent minutes across a theme's ~100 chunks, which looked exactly like a hung build.
    const binary = path.join(toolchainRoot, 'node_modules', '.bin', 'terser');
    if (!fs.existsSync(binary)) {
      return BuildStepResult.skipped(AssetMinifier.STEP, `terser is not installed under ${toolchainRoot}`);
    }

    const files = fs.readdirSync(dir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => path.join(dir, name))
      .filter((file) => fs.statSync(file).isFile());
    if (files.length === 0) return BuildStepResult.skipped(AssetMinifier.STEP, 'no .js files');

    const kept: string[] = [];
    const queue = [...files];
    const workers = Array.from(
      { length: Math.min(Math.max(os.cpus().length, 1), AssetMinifier.MAX_WORKERS) },
      async () => {
        for (;;) {
          const file = queue.shift();
          if (!file) return;
          if (!(await AssetMinifier.minifyOne(binary, file))) kept.push(path.basename(file));
        }
      },
    );
    await Promise.all(workers);

    if (kept.length > 0) {
      return BuildStepResult.skipped(AssetMinifier.STEP, `terser could not parse ${kept.sort().join(', ')}; kept unminified`);
    }
    return BuildStepResult.ok(AssetMinifier.STEP);
  }

  /** True when the file was minified; false when it was kept as-is. Never leaves a temp file. */
  private static async minifyOne(binary: string, file: string): Promise<boolean> {
    const temporary = `${file}.min.tmp`;
    const hadShim = fs.readFileSync(file, 'utf8').includes(AssetMinifier.SHIM_MARKER);

    const ok = await new Promise<boolean>((resolve) => {
      execFile(binary, [
        file, '--module',
        '--compress', 'drop_console=true,drop_debugger=true',
        '--mangle', '--format', 'comments=false',
        '-o', temporary,
      ], (error) => resolve(!error));
    });

    // A file terser cannot parse is KEPT unminified. Losing it would be far worse than shipping it
    // large, and the temp file must not survive either outcome.
    if (!ok || !fs.existsSync(temporary)) {
      fs.rmSync(temporary, { force: true });
      return false;
    }

    // terser runs with `--module`, so a top-level `var require` is a module-scoped binding it
    // considers unused and DROPS. That binding is the browser require shim, and without it the
    // bundle throws "Dynamic require of react is not supported" and not one component registers.
    // Put it back rather than weakening the minifier: the shim must survive by construction.
    const minified = fs.readFileSync(temporary, 'utf8');
    const lostShim = hadShim && !minified.includes(AssetMinifier.SHIM_MARKER);
    fs.writeFileSync(file, lostShim ? `${BuildToolchain.BROWSER_REQUIRE_SHIM}${minified}` : minified);
    fs.rmSync(temporary, { force: true });
    return true;
  }
}

import { build } from 'esbuild';
import { TyporEsbuildPlugin } from '../typor-esbuild-plugin';
import { TyporCommand } from './typor-command';

/**
 * `typor esbuild <entry> [flags…]` — esbuild, with typor's extended syntax understood.
 *
 * Anything that bundles framework SOURCE (rather than a package's built `dist`) has to parse
 * `class X extends A, B`. The esbuild CLI cannot load a plugin, so a bare `esbuild …` call fails with
 * `Expected "{" but found ","` the moment it reaches a multiple-inheritance class. This takes the same
 * arguments as the CLI and runs them through esbuild's JS API with `TyporEsbuildPlugin` installed.
 *
 * Only the flags this repo actually uses are translated; an unrecognised flag is a HARD error rather
 * than a silent drop, so a build can never quietly lose `--external` or `--minify`.
 */
export class EsbuildCommand extends TyporCommand {
  readonly summary = 'esbuild with typor extended syntax understood <entry> [flags…].';

  async run(argv: string[]): Promise<number> {
    const options: any = { entryPoints: [], external: [], plugins: [TyporEsbuildPlugin.esbuild()] };

    for (const arg of argv) {
      if (!arg.startsWith('--')) { options.entryPoints.push(arg); continue; }
      const [flag, value] = arg.slice(2).split(/=(.*)/s);
      switch (flag) {
        case 'bundle':    options.bundle = true; break;
        case 'minify':    options.minify = true; break;
        case 'sourcemap': options.sourcemap = value ?? true; break;
        case 'splitting': options.splitting = true; break;
        case 'format':    options.format = value; break;
        case 'target':    options.target = value; break;
        case 'platform':  options.platform = value; break;
        case 'outfile':   options.outfile = value; break;
        case 'outdir':    options.outdir = value; break;
        case 'jsx':       options.jsx = value; break;
        case 'loader':    options.loader = { ...(options.loader ?? {}), [value.split(':')[0]]: value.split(':')[1] }; break;
        case 'external':  options.external.push(value); break;
        case 'tsconfig':  options.tsconfig = value; break;
        case 'tsconfig-raw': options.tsconfigRaw = value; break;
        case 'global-name': options.globalName = value; break;
        // A worker/IIFE entry must start itself. That bootstrap is BUILD glue, not source — the same
        // reason nextor generates Next's route exports — so it arrives as a footer, not a top-level call.
        case 'banner:js': options.banner = { js: value }; break;
        case 'footer:js': options.footer = { js: value }; break;
        case 'define':    options.define = { ...(options.define ?? {}), [value.split(/=(.*)/s)[0]]: value.split(/=(.*)/s)[1] }; break;
        default:
          console.error(`[typor esbuild] unsupported flag --${flag}. Add it to EsbuildCommand rather than dropping it.`);
          return 2;
      }
    }

    if (!options.entryPoints.length) {
      console.error('[typor esbuild] no entry point given.');
      return 2;
    }

    try {
      await build(options);
      console.log(`[typor esbuild] built ${options.entryPoints.join(', ')} -> ${options.outfile ?? options.outdir}`);
      return 0;
    } catch {
      return 1; // esbuild already printed the diagnostics
    }
  }
}

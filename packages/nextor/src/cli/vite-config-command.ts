import path from 'node:path';
import { ViteConfigEntryGenerator } from '../vite-config-entry-generator';
import { NextorCommand } from './nextor-command';

/**
 * `nextor vite-config <sourceModule> <ClassName> <outFile>` — emit the Vite config entry for a theme or
 * plugin-UI build.
 *
 * Vite requires a default export from its config module; the authored configs are classes, so the
 * required export is generated at BUILD time — the same job nextor does for Next's route exports and
 * middleware.
 *
 * The source module and class name are ARGUMENTS. The `.mjs` this replaced carried a `TARGETS` map of
 * `theme`/`plugin` -> `packages/sdk/src/vite/<name>`, which baked this project's layout into a package
 * that is meant to be standalone. The sibling `verify-vite-config` already took its paths as arguments
 * for exactly that reason; this now matches it.
 */
export class ViteConfigCommand extends NextorCommand {
  readonly summary = 'Emit a Vite config entry <sourceModule> <ClassName> <outFile>.';

  run(argv: string[]): number {
    const [sourceModule, className, outFile] = argv;
    if (!sourceModule || !className || !outFile) {
      console.error('usage: nextor vite-config <sourceModule> <ClassName> <outFile>');
      return 2;
    }

    const out = path.resolve(outFile);
    // A RELATIVE specifier, deliberately — this is the one place the sdk's `@sdk/` alias must not be
    // used. Vite loads its own config module with its own loader BEFORE any tsconfig `paths` mapping
    // applies, so an aliased import here does not resolve and every plugin-UI and theme build fails
    // (36 of them did). `check-imports` skips generated files for exactly this reason.
    const source = path.resolve(sourceModule).replace(/\.[cm]?tsx?$/, '');
    const rel = path.relative(path.dirname(out), source).replace(/\\/g, '/');
    ViteConfigEntryGenerator.write(out, rel.startsWith('.') ? rel : `./${rel}`, className);
    console.log('[nextor] generated', path.basename(out));
    return 0;
  }
}

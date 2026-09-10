import path from 'node:path';
import { ViteConfigEntryGenerator } from '../vite-config-entry-generator';
import { NextorCommand } from './next-build-codegen-command';

/**
 * `next-build-codegen verify-vite-config [--clean] <entry> [<entry> …]` — fail when a generated Vite config entry
 * has been left in the tree.
 *
 * Vite requires a DEFAULT export from its config module; the authored configs are classes, so that one
 * required export is generated for the duration of a build and removed afterwards — the same contract as
 * the Next middleware glue. The entry PATHS are arguments, never baked in: next-build-codegen knows how to generate
 * and check a Vite config entry, not where any particular project keeps one.
 */
export class VerifyViteConfigCommand extends NextorCommand {
  readonly summary = 'Fail when a generated Vite config entry is left in the tree [--clean] <entry…>.';

  run(argv: string[]): number {
    const clean = argv.includes('--clean');
    const entries = argv.filter((a) => !a.startsWith('--')).map((a) => path.resolve(a));

    if (!entries.length) {
      console.error('usage: next-build-codegen verify-vite-config [--clean] <entry> [<entry> ...]');
      return 2;
    }

    if (clean) {
      const removed = ViteConfigEntryGenerator.clean(entries);
      console.log(`[next-build-codegen] removed ${removed.length} generated Vite config entr${removed.length === 1 ? 'y' : 'ies'}.`);
      return 0;
    }

    const complaint = ViteConfigEntryGenerator.verify(entries);
    if (complaint) {
      console.error(`[next-build-codegen] ${complaint}`);
      console.error('[next-build-codegen] the tree must contain only the authored classes — the entry is transient build output.');
      return 1;
    }
    console.log(`[next-build-codegen] no generated Vite config entries in the tree (${entries.length} checked) — classes only.`);
    return 0;
  }
}

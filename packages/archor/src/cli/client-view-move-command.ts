import path from 'node:path';
import { ClientViewMove } from '../client-view-move';
import { ArchorCommand } from './archor-command';
import { FrameworkRoot } from './framework-root';

/**
 * `archor client-view-move <path> [--roots=a,b] [--apply]` — move `*.client.*` modules into a `view/`
 * folder beside their feature, rewriting every import. DRY RUN by default.
 *
 * Next route entries (`page.client.tsx`, `layout.client.tsx`, …) are NEVER moved — see the class.
 */
export class ClientViewMoveCommand extends ArchorCommand {
  readonly summary = 'Move *.client.* modules into view/ and rewrite imports [<path> --apply].';

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const apply = argv.includes('--apply');
    const rel = argv.find((a) => !a.startsWith('--'));
    if (!rel) {
      console.error('usage: archor client-view-move <path> [--roots=<a,b>] [--apply]');
      return 1;
    }

    // Importers OUTSIDE the moved package still need their specifiers rewritten, so resolution spans the
    // roots — defaulting to every package, since any of them may import a client module from another.
    const rootsArg = argv.find((a) => a.startsWith('--roots='))?.slice('--roots='.length) ?? 'packages';
    const roots = rootsArg.split(',').map((r) => path.resolve(framework, r.trim()));

    const { moved, edited, skipped } = ClientViewMove.run(path.resolve(framework, rel), framework, roots, apply);
    for (const line of moved.slice(0, 20)) console.log('  ' + line);
    if (moved.length > 20) console.log(`  … and ${moved.length - 20} more`);
    for (const line of skipped) console.log('  SKIPPED ' + line);
    console.log(
      `\narchor client-view-move: ${moved.length} file(s) ${apply ? 'moved' : 'would move'}, ` +
      `${edited.length} file(s) ${apply ? 'rewritten' : 'would be rewritten'}, ${skipped.length} skipped.`,
    );
    return 0;
  }
}

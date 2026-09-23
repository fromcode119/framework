import { ExtensionNameGuard } from '../extension-name-guard';
import { DistinctiveNameScan } from '../distinctive-name-scan';
import { ArchorCommand } from './arch-guard-command';

/**
 * `arch-guard extension-names` — the framework names no extension.
 * `arch-guard extension-names --hash <name>…` — print the entry that adds a name to the denied set.
 */
export class ExtensionNameCommand extends ArchorCommand {
  readonly summary = 'Framework code must not name a plugin, theme, appearance or client.';

  run(argv: string[]): number {
    if (argv[0] === '--hash') {
      const names = argv.slice(1);
      if (!names.length) {
        console.error('[arch-guard] --hash needs at least one name.');
        return 2;
      }
      for (const name of names) console.log(`    '${DistinctiveNameScan.hash(name)}',`);
      return 0;
    }
    return ExtensionNameGuard.run();
  }
}

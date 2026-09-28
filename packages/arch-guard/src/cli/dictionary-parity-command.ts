import { DictionaryParityGuard } from '../dictionary-parity-guard';
import { ArchorCommand } from './arch-guard-command';
import { ExtensionTrees } from './extension-trees';
import { GuardScope } from './guard-scope';

/**
 * `arch-guard i18n-parity` — every locale beside an `en.json` translates every English entry.
 *
 * Gates from the first day: every dictionary folder in the framework and in every extension was at
 * zero when it was added, so there is no backlog for a baseline to hide.
 */
export class DictionaryParityCommand extends ArchorCommand {
  readonly summary = 'Every i18n/<locale>.json has every key of its en.json, none empty.';

  run(_argv: string[]): number {
    const failures: string[] = [];
    let folders = 0;
    for (const { dir } of GuardScope.areas()) {
      for (const folder of DictionaryParityGuard.folders(dir)) {
        folders += 1;
        for (const problem of DictionaryParityGuard.problemsIn(folder)) failures.push(`${ExtensionTrees.show(folder)}/${problem}`);
      }
    }

    console.log(`\ni18n parity: ${folders} dictionary folder(s) checked.`);
    if (failures.length) {
      console.log('FAILED — a language that lacks an entry shows English (or the key) in its place:');
      for (const failure of failures) console.log(`  ${failure}`);
      console.log('Translate each missing entry in that locale file.');
      return 1;
    }
    console.log('arch-guard i18n-parity passed.');
    return 0;
  }
}

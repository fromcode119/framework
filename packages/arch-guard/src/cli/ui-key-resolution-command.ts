import path from 'node:path';
import { UiKeyResolutionGuard } from '../ui-key-resolution-guard';
import { ArchorCommand } from './arch-guard-command';
import { ExtensionTrees } from './extension-trees';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';

/**
 * `arch-guard ui-key-resolution` — every static key an extension's screens ask for exists in a
 * dictionary. Applies to extensions that ship `src/ui/i18n/en.json`, the same line `rendered-copy`
 * enforces from: such an extension has said its screens are translated.
 */
export class UiKeyResolutionCommand extends ArchorCommand {
  readonly summary = 'Every static t() key in an extension UI resolves to a dictionary entry.';

  run(_argv: string[]): number {
    const shared = UiKeyResolutionGuard.sharedKeys(path.join(FrameworkRoot.find(), 'packages'));
    const failures: string[] = [];
    let extensions = 0;
    for (const { area, dir } of GuardScope.areas()) {
      if (area === 'framework') continue;
      for (const root of UiKeyResolutionGuard.extensions(dir)) {
        extensions += 1;
        for (const hit of UiKeyResolutionGuard.unresolvedIn(root, shared)) failures.push(`${ExtensionTrees.show(root)}/${hit}`);
      }
    }

    console.log(`\nui key resolution: ${extensions} translated extension UI(s) checked.`);
    if (failures.length) {
      console.log('FAILED — these keys resolve to nothing, so every language shows the English fallback:');
      for (const failure of failures) console.log(`  ${failure}`);
      console.log('Add each key to the extension\'s src/ui/i18n/en.json (and every other locale), or fix its spelling.');
      return 1;
    }
    console.log('arch-guard ui-key-resolution passed.');
    return 0;
  }
}

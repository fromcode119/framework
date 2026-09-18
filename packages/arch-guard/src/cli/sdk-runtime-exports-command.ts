import path from 'node:path';
import { SdkRuntimeExportsGuard } from '../sdk-runtime-exports-guard';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';

/** `arch-guard sdk-runtime-exports` — an extension may import only what the runtime import map publishes. */
export class SdkRuntimeExportsCommand extends ArchorCommand {
  readonly summary = 'Extension UI imports from @fromcode119/sdk must exist in the runtime import map.';

  run(_argv: string[]): number {
    const framework = FrameworkRoot.find();
    const repoRoot = FrameworkRoot.repo();

    // Checked first, and independently of any extension: it is a fault in the framework's own two
    // lists, and it is true whether or not anything imports the name yet.
    const unbacked = SdkRuntimeExportsGuard.unbackedNames(framework);
    const offenders = SdkRuntimeExportsGuard.scan(framework, GuardScope.areas(repoRoot));

    if (!unbacked.length && !offenders.length) {
      console.log('[check-sdk-runtime-exports] OK');
      return 0;
    }

    if (unbacked.length) {
      console.error('[check-sdk-runtime-exports] SDK_EXPORT_KEYS publishes names the runtime bridge does not carry:');
      for (const name of unbacked) console.error(`- ${name}`);
      console.error('\nThe generated module reads every key off the bridge object, so each of these exports'
        + '\n`undefined`: the import succeeds and the first use throws. Add them to BridgeObjectBuilder.');
    }

    if (offenders.length) {
      console.error('[check-sdk-runtime-exports] these extension files import SDK names the browser cannot resolve:');
      for (const { file, names } of offenders) {
        console.error(`- ${path.relative(repoRoot, file)}`);
        for (const name of names) console.error(`    ${name}`);
      }
      console.error('\nA bundle importing a name that is not in the runtime import map does not lose one symbol —'
        + '\nit fails to LOAD ("does not provide an export named …") and the whole extension is gone, with'
        + '\nnothing but one line in the browser console. Either add the name to'
        + '\n`SdkExportSourceBuilder.SDK_EXPORT_KEYS` AND `BridgeObjectBuilder` (both, or it is `undefined`),'
        + '\nor stop importing it as a value — `import type` and type-only uses are erased and need nothing.');
    }
    return 1;
  }
}

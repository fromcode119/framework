import { ImportGuard } from '../import-guard';
import { ArchorCommand } from './archor-command';
import { FrameworkRoot } from './framework-root';

/**
 * `archor imports` — every specifier must resolve, and in-package imports must use the package alias.
 *
 *   archor imports                       # report
 *   ARCHOR_IMPORTS_MODE=error archor …   # fail the build on any finding
 */
export class ImportsCommand extends ArchorCommand {
  readonly summary = 'Unresolvable specifiers and non-alias in-package imports.';

  run(_argv: string[]): number {
    const framework = FrameworkRoot.find();
    const { broken, style } = ImportGuard.scan(FrameworkRoot.repo(), framework);

    for (const line of broken) console.log(`  BROKEN  ${line}`);
    for (const line of style) console.log(`  STYLE   ${line}`);
    console.log(`[check-imports] ${broken.length} unresolvable, ${style.length} style deviations.`);

    if (process.env.ARCHOR_IMPORTS_MODE === 'error' && (broken.length || style.length)) {
      console.error('\n[check-imports] FAILED — an import does not resolve, or does not follow the house style.');
      return 1;
    }
    console.log('[check-imports] OK');
    return 0;
  }
}

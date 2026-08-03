import path from 'node:path';
import { SrcArtifactGuard } from '../src-artifact-guard';
import { ArchorCommand } from './archor-command';
import { FrameworkRoot } from './framework-root';

/** `archor src-artifacts` — emitted `.js`/`.d.ts` must never sit beside the sources they shadow. */
export class SrcArtifactsCommand extends ArchorCommand {
  readonly summary = 'Build artifacts inside packages/*/src, and bundles shadowing plugin/theme source.';

  /**
   * A plugin/theme legitimately ships bundles beside its source, so those areas get the SHADOW-only rule.
   * `manifest.main` is `index.js`, and the api serves `ui/*.js` / `ui-ssr/*.mjs` straight off disk.
   */
  private static readonly BUNDLE_ROOTS: readonly string[] = ['/src/ui/', '/ui/', '/ui-ssr/'];

  run(_argv: string[]): number {
    const framework = FrameworkRoot.find();
    const repoRoot = path.resolve(framework, '..', '..');
    // Framework packages: STRICT — no emitted output under an authored source root at all.
    const offenders = SrcArtifactGuard.findAll(path.join(framework, 'packages'));
    // Plugins/themes/appearances: SHADOW-only. This area had NO coverage before — the gate reported OK
    // while never looking at it.
    for (const area of ['plugins', 'themes', 'appearance']) {
      offenders.push(
        ...SrcArtifactGuard.findShadowing(path.join(repoRoot, area), SrcArtifactsCommand.BUNDLE_ROOTS)
          .filter((f: string) => !/\/index\.js$/.test(f)),
      );
    }
    if (!offenders.length) {
      console.log('[archor src-artifacts] OK (framework strict; plugins/themes shadow-only)');
      return 0;
    }

    const shown = offenders.slice(0, 10).map((f: string) => '  ' + path.relative(repoRoot, f));
    console.error(
      `[archor src-artifacts] ${offenders.length} build artifact(s) shadowing authored source:\n` +
      shown.join('\n') + (offenders.length > 10 ? `\n  … and ${offenders.length - 10} more` : '') +
      '\n\nThese shadow their .ts siblings and break Enum reference identity at runtime.\n' +
      SrcArtifactGuard.remedy(),
    );
    return 1;
  }
}

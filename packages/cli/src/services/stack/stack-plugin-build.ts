import chalk from 'chalk';
import { StackExtensions } from '@cli/services/stack/stack-extensions';

/**
 * Builds the plugin worktrees a stack mounts, in place, before it starts.
 *
 * A plugin runs from its BUILT entry (`index.js`, `ui/`, `ui-ssr/`, `dist/`), which git does not
 * carry, so a fresh worktree has only sources and the api fails to activate it. `fromcode build
 * plugin <slug>` cannot reach a worktree: it looks only under the plugins directory, by slug, and a
 * worktree is named for its change. So the stack builds what it mounts, through the same pipeline,
 * keyed by the manifest's slug rather than the directory name.
 *
 * Only worktrees are built. The mirror's copies are mounted read-only and are not a change; writing
 * build output into them is exactly what no session may do.
 */
export class StackPluginBuild {
  static async all(directories: readonly string[]): Promise<void> {
    for (const directory of directories) await StackPluginBuild.one(directory);
  }

  private static async one(directory: string): Promise<void> {
    // Imported lazily, as `fromcode build` does: the builder's graph is heavy and only `up` needs it.
    const { ExtensionBuildPipeline, ExtensionKind } = await import('@fromcode119/extension-builder');
    const slug = StackExtensions.slugOf(directory);
    console.log(chalk.blue(`  Building plugin ${slug} from ${directory}`));

    const steps = await ExtensionBuildPipeline.run({ sourceDir: directory, kind: ExtensionKind.PLUGIN, slug, pack: false });
    const failed = steps.filter((step) => step.failed);
    if (failed.length === 0) return;

    const detail = failed.map((step) => `    ✗ ${step.step}${step.message ? `: ${step.message}` : ''}`).join('\n');
    throw new Error(`Plugin ${slug} at ${directory} did not build, so the stack would run without it:\n${detail}`);
  }
}

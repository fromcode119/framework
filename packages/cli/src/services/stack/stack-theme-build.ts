import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * Builds the theme worktrees a stack mounts, in place, before it starts.
 *
 * A theme runs from its BUILT output (`ui/`, `ui-ssr/`, the head script and seed), which git does not carry,
 * so a fresh worktree has only sources. `fromcode build theme <slug>` looks the theme up by slug under the
 * themes root; a worktree is named for its change, so the stack builds what it mounts, through the same
 * pipeline, keyed by the manifest's slug.
 */
export class StackThemeBuild {
  /** The slug the platform knows a theme by: `theme.json`'s, never the directory name. */
  static slugOf(directory: string): string {
    const manifest = path.join(directory, 'theme.json');
    if (!fs.existsSync(manifest)) throw new Error(`${directory} has no theme.json, so it is not a theme`);

    const slug = String((JSON.parse(fs.readFileSync(manifest, 'utf8')) as { slug?: string }).slug ?? '').trim();
    if (!slug) throw new Error(`${manifest} names no slug`);
    return slug;
  }

  static async all(directories: readonly string[] | undefined): Promise<void> {
    for (const directory of directories ?? []) await StackThemeBuild.one(directory);
  }

  /**
   * A site made on the stack is given the theme's initial content (its home page and menus) by running its
   * seed, which `theme.json` names `seed.mjs`. An in-place build leaves the compiled seed elsewhere, so the
   * site was made with no home page: the file is copied beside `theme.json`, where git already ignores it.
   */
  static placeSeed(directory: string, slug: string, built: string): void {
    if (!fs.existsSync(built)) {
      console.log(chalk.yellow(`  Theme ${slug} built no seed, so a site made on this stack gets no home page from it.`));
      return;
    }
    fs.copyFileSync(built, path.join(directory, 'seed.mjs'));
  }

  private static async one(directory: string): Promise<void> {
    // Imported lazily, as `fromcode build` does: the builder's graph is heavy and only `up` needs it.
    const { ExtensionBuildPipeline, ExtensionKind } = await import('@fromcode119/extension-builder');
    const slug = StackThemeBuild.slugOf(directory);
    console.log(chalk.blue(`  Building theme ${slug} from ${directory}`));

    const steps = await ExtensionBuildPipeline.run({ sourceDir: directory, kind: ExtensionKind.THEME, slug, pack: false });
    const failed = steps.filter((step) => step.failed);
    if (failed.length === 0) {
      StackThemeBuild.placeSeed(directory, slug, ExtensionBuildPipeline.builtThemeSeedPath(directory, slug));
      return;
    }

    const detail = failed.map((step) => `    ✗ ${step.step}${step.message ? `: ${step.message}` : ''}`).join('\n');
    throw new Error(`Theme ${slug} at ${directory} did not build, so the stack would run without it:\n${detail}`);
  }
}

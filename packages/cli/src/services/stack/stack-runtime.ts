import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { StackImageLedger } from '@cli/services/stack/stack-image-ledger';
import { StackImagePull } from '@cli/services/stack/stack-image-pull';
import { StackImageTag } from '@cli/services/stack/stack-image-tag';
import { StackReleaseCatalog } from '@cli/services/stack/stack-release-catalog';
import { StackReleaseSource } from '@cli/services/stack/stack-release-source';
import { StackService } from '@cli/services/stack/stack-service';
import { StackStore } from '@cli/services/stack/stack-store';
import { StackTemplate } from '@cli/services/stack/stack-template';
import type { IStackRuntime } from '@cli/services/stack/interfaces/stack-runtime.interface';
import type { IStackRuntimeQuery } from '@cli/services/stack/interfaces/stack-runtime-query.interface';

/**
 * What platform a stack runs: whose files, and which release's images.
 *
 * With a framework worktree, that worktree is mounted over the images of its version. With no
 * `--framework` and run from the shared checkout, there is no framework change to see, so the stack
 * runs the latest release as published — the usual case for a plugin or a theme.
 */
export class StackRuntime {
  constructor(private readonly store: StackStore = new StackStore()) {}

  async resolve(query: IStackRuntimeQuery): Promise<IStackRuntime> {
    const framework = path.resolve(query.framework ?? query.directory);
    const asRelease = !query.framework && StackService.isSharedCheckout(framework);

    const images = StackImageTag.of(framework);
    const releases = new StackReleaseCatalog(framework);
    const choice = await images.choose({
      explicit: query.tag,
      preferred: asRelease ? null : StackRuntime.versionOf(framework),
      template: query.template ? StackTemplate.versionAt(this.store.root, query.template) : null,
      releases: query.pull ? releases : null,
    });
    if (choice.note) console.log(chalk.yellow(`\n${choice.note}`));

    await this.bring(images, releases, choice.tag, query.pull);

    if (!asRelease) return { framework, version: choice.tag };

    const release = await new StackReleaseSource(framework, this.store.root).directoryFor(choice.tag);
    return { framework: release, checkout: framework, version: choice.tag };
  }

  /** Pulls the tag if it is not here, then takes away releases an earlier pull left behind. */
  private async bring(images: StackImageTag, releases: StackReleaseCatalog, tag: string, pull: boolean): Promise<void> {
    if (!images.lacking(tag).length) return;
    if (!pull) throw new Error(`${tag} is not on this machine and --no-pull was given.`);

    await new StackImagePull(images, releases).ensure(tag);

    const ledger = new StackImageLedger(this.store.root);
    ledger.record(tag);
    const inUse = new Set([tag, ...this.store.list().map((stack) => stack.version)]);
    const retired = await ledger.retire(images.images, inUse);
    if (retired.length) console.log(chalk.gray(`  Removed the images of ${retired.join(', ')}, which no stack uses.`));
  }

  /**
   * The worktree's own version: the image whose node_modules matches the code being mounted over it. A
   * mismatch is not theoretical — a theme packed against one tag and served by another made every sdk
   * component undefined and crashed the editor with React #130.
   */
  private static versionOf(framework: string): string {
    const file = path.join(framework, 'package.json');
    if (!fs.existsSync(file)) throw new Error(`${framework} has no package.json`);

    const version = String((JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string }).version || '').trim();
    if (!version) throw new Error(`${file} declares no version`);
    return version.startsWith('v') ? version : `v${version}`;
  }
}

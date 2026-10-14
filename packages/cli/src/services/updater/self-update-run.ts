import { UpdaterState } from '@fromcode119/core';
import { ImageRetention } from '@cli/services/deploy/image-retention';
import { ContainerReplacement } from '@cli/services/updater/container-replacement';
import type { IContainerSummary } from '@cli/services/updater/interfaces/container-summary.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';
import type { IReplacedContainer } from '@cli/services/updater/interfaces/replaced-container.interface';
import type { IUpdaterHealth } from '@cli/services/updater/interfaces/updater-health.interface';
import type { IVersionFile } from '@cli/services/updater/interfaces/version-file.interface';
import type { IUpdateOutcome } from '@cli/services/updater/interfaces/update-outcome.interface';

/**
 * One update of this deployment from the version it runs to a newer published one, done by the
 * deployment itself.
 *
 * The order is the deploy CLI's, for the same reasons: every image is pulled BEFORE anything is
 * stopped (an unpublished or unreachable version must change nothing); the version file is written
 * before the swap so a later `docker compose up` agrees with what is running; the api must report the
 * NEW version (a crash-looping image leaves nothing else to tell by); anything short of that puts every
 * replaced container back; old images are removed only after success, keeping the one replaced.
 */
export class SelfUpdateRun {
  /** Replaced in this order: plugin hosts before the api that drives them, the gateway last. */
  static readonly SERVICES = ['extension-host', 'site-extension-host', 'api', 'admin', 'frontend', 'gateway'];
  static readonly PROJECT_LABEL = 'com.docker.compose.project';
  static readonly SERVICE_LABEL = 'com.docker.compose.service';

  private readonly replacement: ContainerReplacement;

  constructor(
    private readonly engine: IDockerEngine,
    private readonly health: IUpdaterHealth,
    private readonly versionFile: IVersionFile,
    private readonly project: string,
    private readonly onStep: (step: string) => void = () => undefined,
  ) {
    this.replacement = new ContainerReplacement(engine);
  }

  async run(from: string, to: string): Promise<IUpdateOutcome> {
    const tag = SelfUpdateRun.tag(to);
    const targets = await this.targets(SelfUpdateRun.tag(from));
    if (!targets.length) return SelfUpdateRun.failed(`No platform container of project "${this.project}" runs ${SelfUpdateRun.tag(from)}.`);

    for (const repository of [...new Set(targets.map((target) => SelfUpdateRun.repository(target.Image)))]) {
      // A version tag is never re-pointed, so an image already here is that version — no second download.
      if (await this.engine.hasImage(`${repository}:${tag}`)) continue;
      this.onStep(`Downloading ${repository.split('/').pop()}:${tag}`);
      const error = await this.engine.pull(repository, tag);
      if (error) return SelfUpdateRun.failed(`Could not download ${repository}:${tag} — ${error}. Nothing was changed.`);
    }

    const previousVersion = this.versionFile.read();
    this.versionFile.write(tag);
    const replaced: IReplacedContainer[] = [];
    try {
      for (const target of targets) {
        const service = target.Labels[SelfUpdateRun.SERVICE_LABEL];
        this.onStep(`Starting the new ${service}`);
        replaced.push(await this.replacement.replace(service, target.Id, `${SelfUpdateRun.repository(target.Image)}:${tag}`));
      }
    } catch (error) {
      await this.rollBack(replaced, previousVersion);
      return { state: UpdaterState.ROLLED_BACK.value, error: `Could not start the new version: ${(error as Error).message}` };
    }

    this.onStep(`Waiting for the platform to report ${tag}`);
    if (!(await this.health.reports(tag))) {
      await this.rollBack(replaced, previousVersion);
      return { state: UpdaterState.ROLLED_BACK.value, error: `${tag} did not report itself healthy; ${SelfUpdateRun.tag(from)} is serving again.` };
    }

    this.onStep('Removing what the update replaced');
    for (const done of replaced) await this.replacement.discard(done).catch(() => undefined);
    await this.prune(tag, SelfUpdateRun.tag(from));
    return { state: UpdaterState.SUCCEEDED.value, error: '' };
  }

  /** The platform's own containers on the version being replaced. An `EDGE_IMAGE` someone chose is not ours to replace. */
  private async targets(fromTag: string): Promise<IContainerSummary[]> {
    const containers = await this.engine.listContainers([`${SelfUpdateRun.PROJECT_LABEL}=${this.project}`]);
    return SelfUpdateRun.SERVICES.flatMap((service) => containers.filter((container) =>
      container.Labels[SelfUpdateRun.SERVICE_LABEL] === service
      && container.Image.startsWith(ImageRetention.REGISTRY_PREFIX)
      && container.Image.endsWith(`:${fromTag}`)));
  }

  private async rollBack(replaced: IReplacedContainer[], previousVersion: string): Promise<void> {
    this.onStep('Putting the previous version back');
    for (const done of [...replaced].reverse()) await this.replacement.restore(done).catch(() => undefined);
    this.versionFile.write(previousVersion);
  }

  private async prune(deployed: string, replacedTag: string): Promise<void> {
    const removable = ImageRetention.prunable(await this.engine.listImages(), ImageRetention.keepSet(deployed, replacedTag));
    for (const image of removable) await this.engine.removeImage(image).catch(() => undefined);
  }

  static tag(version: string): string {
    const bare = String(version || '').trim().replace(/^v/, '');
    return bare ? `v${bare}` : '';
  }

  private static repository(image: string): string {
    return image.slice(0, image.lastIndexOf(':'));
  }

  private static failed(error: string): IUpdateOutcome {
    return { state: UpdaterState.FAILED.value, error };
  }
}

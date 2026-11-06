import { DeployMode, UpdaterState } from '@fromcode119/core';
import { ImageRetention } from '@cli/services/deploy/image-retention';
import { DeployStrategy } from '@cli/services/deploy/deploy-strategy';
import { RollingDeploy } from '@cli/services/deploy/rolling-deploy';
import { ContainerReplacement } from '@cli/services/updater/container-replacement';
import { EngineStack } from '@cli/services/updater/engine-stack';
import type { IDeployStack } from '@cli/services/deploy/interfaces/deploy-stack.interface';
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
 *
 * And it rolls the way the deploy command does — `DeployStrategy` decides, `RollingDeploy` swaps, over
 * the same Engine API — so an update starts each new app beside the old one and stops the old one only
 * once the new one answers. It falls back to replacing the containers in place only where the deploy
 * command would restart too (the operator chose restart, a migration the serving release cannot run
 * beside, not enough memory), and for an install that names no version yet.
 */
export class SelfUpdateRun {
  /** Replaced in this order: plugin hosts before the api that drives them, the gateway last. */
  static readonly SERVICES = ['extension-host', 'site-extension-host', 'api', 'admin', 'frontend', 'gateway'];
  static readonly PROJECT_LABEL = EngineStack.PROJECT_LABEL;
  static readonly SERVICE_LABEL = EngineStack.SERVICE_LABEL;
  /**
   * The tag the compose files fall back to when `.env` names no `VERSION` (`${VERSION:-latest}`). An
   * install that never wrote one runs every service on it, and the api it serves is the version being
   * replaced — so those containers are that version, and the update is what pins them.
   */
  static readonly UNPINNED_TAG = 'latest';
  private static readonly GATEWAY = 'gateway';

  private readonly replacement: ContainerReplacement;

  constructor(
    private readonly engine: IDockerEngine,
    private readonly health: IUpdaterHealth,
    private readonly versionFile: IVersionFile,
    private readonly project: string,
    private readonly onStep: (step: string) => void = () => undefined,
    private readonly rolling: (stack: IDeployStack) => RollingDeploy = (stack) => new RollingDeploy(stack),
    private readonly availableBytes?: () => number,
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
    const unpinned = targets.some((target) => target.Image.endsWith(`:${SelfUpdateRun.UNPINNED_TAG}`));
    const replacedTag = unpinned ? SelfUpdateRun.UNPINNED_TAG : SelfUpdateRun.tag(from);
    const plan = unpinned
      ? { mode: DeployMode.RESTART, reason: 'this install names no version yet, so the first update pins one with a restart' }
      : await new DeployStrategy(this.stackFor(tag)).choose();
    this.onStep(`Deploy mode: ${plan.mode.value} — ${plan.reason}`);
    if (plan.mode === DeployMode.ROLLING) return this.roll(tag, replacedTag, previousVersion);

    // The gateway terminates TLS with certificates it fetches from the api. A new gateway started while
    // the new api still boots has none, and refuses every handshake until it does: so it is replaced
    // only once the api reports the new version, and the old gateway keeps serving until then.
    const isGateway = (target: IContainerSummary) => target.Labels[SelfUpdateRun.SERVICE_LABEL] === SelfUpdateRun.GATEWAY;
    const replaced: IReplacedContainer[] = [];
    for (const [batch, waitFor] of [[targets.filter((target) => !isGateway(target)), true], [targets.filter(isGateway), false]] as const) {
      try {
        for (const target of batch) {
          const service = target.Labels[SelfUpdateRun.SERVICE_LABEL];
          this.onStep(`Starting the new ${service}`);
          replaced.push(await this.replacement.replace(service, target.Id, `${SelfUpdateRun.repository(target.Image)}:${tag}`));
        }
      } catch (error) {
        await this.rollBack(replaced, previousVersion);
        return { state: UpdaterState.ROLLED_BACK.value, error: `Could not start the new version: ${(error as Error).message}` };
      }
      if (!waitFor) continue;
      this.onStep(`Waiting for the platform to report ${tag}`);
      if (!(await this.health.reports(tag))) {
        await this.rollBack(replaced, previousVersion);
        return { state: UpdaterState.ROLLED_BACK.value, error: `${tag} did not report itself healthy; ${SelfUpdateRun.tag(from)} is serving again.` };
      }
    }

    this.onStep('Removing what the update replaced');
    for (const done of replaced) await this.replacement.discard(done).catch(() => undefined);
    // The image a rollback would start is the one the replaced containers ran — on an unpinned install
    // that is `latest`, not the version tag, and pruning it would leave nothing to go back to.
    await this.prune(tag, replacedTag);
    return { state: UpdaterState.SUCCEEDED.value, error: '' };
  }

  /**
   * Each app is swapped with no gap; a failure rolls the apps already swapped back the same way, so the
   * operator who gets no downtime on the way up does not get it on the way back either.
   */
  private async roll(tag: string, replacedTag: string, previousVersion: string): Promise<IUpdateOutcome> {
    this.onStep(`Starting each new app beside the running one`);
    const rolled = await this.rolling(this.stackFor(tag)).run(tag);
    const healthy = rolled && await this.health.reports(tag);
    if (!healthy) {
      this.onStep('Putting the previous version back');
      const restored = await this.rolling(this.stackFor(replacedTag)).run(replacedTag);
      if (previousVersion) this.versionFile.write(previousVersion); else this.versionFile.clear();
      const why = rolled ? `${tag} did not report itself healthy` : `${tag} did not come up`;
      return { state: UpdaterState.ROLLED_BACK.value, error: restored ? `${why}; ${replacedTag} is serving again.` : `${why}, and putting ${replacedTag} back did not finish — the stack needs a person.` };
    }
    this.onStep('Removing what the update replaced');
    await this.prune(tag, replacedTag);
    return { state: UpdaterState.SUCCEEDED.value, error: '' };
  }

  /**
   * The platform's own containers on the version being replaced — tagged with it, or unpinned (see
   * UNPINNED_TAG). An `EDGE_IMAGE` someone chose is not ours to replace.
   */
  private async targets(fromTag: string): Promise<IContainerSummary[]> {
    const containers = await this.engine.listContainers([`${SelfUpdateRun.PROJECT_LABEL}=${this.project}`]);
    return SelfUpdateRun.SERVICES.flatMap((service) => containers.filter((container) =>
      container.Labels[SelfUpdateRun.SERVICE_LABEL] === service
      && container.Image.startsWith(ImageRetention.REGISTRY_PREFIX)
      && (container.Image.endsWith(`:${fromTag}`) || container.Image.endsWith(`:${SelfUpdateRun.UNPINNED_TAG}`))));
  }

  private async rollBack(replaced: IReplacedContainer[], previousVersion: string): Promise<void> {
    this.onStep('Putting the previous version back');
    for (const done of [...replaced].reverse()) await this.replacement.restore(done).catch(() => undefined);
    // An install that named no version goes back to naming none, so `docker compose up` keeps starting
    // what is serving rather than the version that was just refused.
    if (previousVersion) this.versionFile.write(previousVersion); else this.versionFile.clear();
  }

  private stackFor(tag: string): EngineStack {
    return new EngineStack(this.engine, this.project, tag, this.availableBytes);
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

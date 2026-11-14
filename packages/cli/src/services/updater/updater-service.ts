import os from 'os';
import path from 'path';
import { ApiVersionUtils, AutomaticUpdatePolicy, BootstrapSecretsService, EnvUtils, UpdaterState } from '@fromcode119/core';
import { SelfUpdateRun } from '@cli/services/updater/self-update-run';
import { UpdaterApiClient } from '@cli/services/updater/updater-api-client';
import { DockerEngineClient } from '@cli/services/updater/docker-engine-client';
import { EnvVersionFile } from '@cli/services/updater/env-version-file';
import { UpdaterHandover } from '@cli/services/updater/updater-handover';
import { ComposeDirectory } from '@cli/services/updater/compose/compose-directory';
import { LocalDeploymentLock } from '@cli/services/updater/local-deployment-lock';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';
import type { IUpdaterStatus } from '@cli/services/updater/interfaces/updater-status.interface';

/**
 * The updater service: once a minute it asks the api what to install, installs it, and says how it went.
 *
 * The decision is the api's (Settings → Updates: automatic or not, a requested version, a breaking
 * release holding back); this process only carries it out, so the operator's switch is the one control
 * over it. Every poll also reports, so the screen can tell a running updater from an absent one.
 */
export class UpdaterService {
  static readonly POLL_MS = 60_000;
  static readonly ENV_API = 'UPDATER_API_URL';
  static readonly ENV_FILE = 'UPDATER_ENV_FILE';
  static readonly ENV_SOCKET = 'UPDATER_DOCKER_SOCKET';
  static readonly ENV_SWITCH = 'FROMCODE_UPDATER';
  /** The step text the screen recognises for a deployment that turned the updater off. */
  static readonly OFF_STEP = 'turnedOffByDeployment';

  private last: IUpdaterStatus = UpdaterService.status(UpdaterState.IDLE.value);
  /** The version this process failed to keep; never taken again automatically, whatever the api says. */
  private failedTarget = '';
  private busy = false;
  /** A successor on the installed version runs; this one only waits to be retired by it. */
  private handedOver = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly engine: IDockerEngine,
    private readonly api: UpdaterApiClient,
    private readonly versionFile: EnvVersionFile,
    private readonly directory: ComposeDirectory,
    private readonly project: string,
    /** Moves the updater itself onto each version it installs; absent when it does not run in a container. */
    private readonly handover: UpdaterHandover | null = null,
    /** The deployment folder's lock, shared with the deploy command; absent, nothing else deploys here. */
    private readonly lock: Pick<LocalDeploymentLock, 'acquire' | 'release'> | null = null,
  ) {}

  static async fromEnvironment(): Promise<UpdaterService> {
    BootstrapSecretsService.adopt();
    const engine = new DockerEngineClient(process.env[UpdaterService.ENV_SOCKET] || DockerEngineClient.DEFAULT_SOCKET);
    // This container's own compose project names the stack it updates: a hostname is the container id.
    const self = await engine.inspect(os.hostname());
    const project = String(self.Config?.Labels?.[SelfUpdateRun.PROJECT_LABEL] ?? '');
    if (!project) throw new Error('The updater must run as a service of the platform\'s compose project.');
    // The `.env` sits in the deployment folder, beside the compose files the updater brings to each release.
    const envFile = process.env[UpdaterService.ENV_FILE] || '/app/deploy-project/.env';
    return new UpdaterService(
      engine,
      new UpdaterApiClient(process.env[UpdaterService.ENV_API] || `http://api:3000${ApiVersionUtils.prefix()}`),
      new EnvVersionFile(envFile),
      new ComposeDirectory(path.dirname(envFile)),
      project,
      new UpdaterHandover(engine, project, self.Id, path.dirname(envFile)),
      new LocalDeploymentLock(path.dirname(envFile)),
    );
  }

  start(): void {
    console.log(`[updater] watching compose project "${this.project}"`);
    void this.retirePredecessors().then(() => this.tick());
    this.timer = setInterval(() => { void this.tick(); }, UpdaterService.POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * `FROMCODE_UPDATER=off` in the deployment's `.env`: this deployment is updated some other way. The
   * `ATLANTIS_UPDATER` spelling an existing `.env` carries still counts — `EnvUtils` resolves it.
   */
  static get turnedOff(): boolean {
    return EnvUtils.text(UpdaterService.ENV_SWITCH).toLowerCase() === 'off';
  }

  /** An updater this one replaced stops here, before this one acts, so two never update at once. */
  async retirePredecessors(): Promise<void> {
    const retired = await this.handover?.retirePredecessors().catch((error: Error) => {
      console.error(`[updater] could not retire the previous updater: ${error.message}`);
      return 0;
    });
    if (retired) console.log(`[updater] took over from the previous updater (${retired} retired)`);
  }

  async tick(): Promise<void> {
    if (this.busy || this.handedOver) return;
    BootstrapSecretsService.adopt();
    if (UpdaterService.turnedOff) {
      await this.api.report({ ...UpdaterService.status(UpdaterState.IDLE.value), step: UpdaterService.OFF_STEP });
      return;
    }
    const plan = await this.api.plan();
    const retryingFailure = plan?.reason !== AutomaticUpdatePolicy.REQUESTED && plan?.target === this.failedTarget;
    if (!plan?.target || retryingFailure) {
      await this.api.report({ ...this.last, step: this.last.state === UpdaterState.IDLE.value ? '' : this.last.step });
      return;
    }
    // Somebody deploys to this folder from outside (the deploy command): two at once undo each other.
    const heldBy = this.lock?.acquire() ?? '';
    if (heldBy) {
      console.log(`[updater] ${heldBy} is deploying to this folder; ${plan.target} waits until it has finished`);
      await this.api.report({ ...this.last, step: this.last.state === UpdaterState.IDLE.value ? '' : this.last.step });
      return;
    }
    this.busy = true;
    try {
      await this.update(plan.current, plan.target, plan.allowRestart === true);
    } finally {
      this.busy = false;
      this.lock?.release();
    }
  }

  private async update(from: string, to: string, allowRestart = false): Promise<void> {
    const startedAt = new Date().toISOString();
    const steps: string[] = [];
    const plan = () => ({ deployMode: run.plan?.mode ?? '', deployReason: run.plan?.reason ?? '' });
    const report = (step: string) => {
      steps.push(step);
      console.log(`[updater] ${from} -> ${to}: ${step}`);
      this.last = { ...UpdaterService.status(UpdaterState.UPDATING.value), from, to, startedAt, step, steps: [...steps], ...plan() };
      void this.api.report(this.last);
    };
    const run = new SelfUpdateRun(this.engine, this.api, this.versionFile, this.directory, this.project, report);
    const outcome = await run.run(from, to, allowRestart)
      .catch((error: Error) => ({ state: UpdaterState.FAILED.value, error: error.message }));
    this.last = { ...this.last, ...plan(), state: outcome.state, error: outcome.error, finishedAt: new Date().toISOString(), step: '' };
    console.log(`[updater] ${from} -> ${to}: ${outcome.state}${outcome.error ? ` — ${outcome.error}` : ''}`);
    // A held update changed nothing and is retried by the api's plan (at night, or on "Update with restart").
    this.failedTarget = [UpdaterState.FAILED.value, UpdaterState.ROLLED_BACK.value].includes(outcome.state) ? to : '';
    await this.api.reportUntilStored(this.last);
    if (outcome.state === UpdaterState.SUCCEEDED.value) await this.handOver(SelfUpdateRun.tag(to));
  }

  /** The installed version's updater takes over; this one stops acting and is retired by it. */
  private async handOver(tag: string): Promise<void> {
    if (!this.handover) return;
    const handed = await this.handover.handTo(tag).catch((error: Error) => {
      console.error(`[updater] could not start the updater of ${tag}: ${error.message}`);
      return false;
    });
    if (!handed) return;
    console.log(`[updater] the updater of ${tag} takes over`);
    this.handedOver = true;
    this.stop();
  }

  private static status(state: string): IUpdaterStatus {
    return { state, from: '', to: '', startedAt: '', finishedAt: '', step: '', steps: [], error: '', deployMode: '', deployReason: '' };
  }
}

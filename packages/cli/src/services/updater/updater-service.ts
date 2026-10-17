import os from 'os';
import { ApiVersionUtils, AutomaticUpdatePolicy, BootstrapSecretsService, UpdaterState } from '@fromcode119/core';
import { SelfUpdateRun } from '@cli/services/updater/self-update-run';
import { UpdaterApiClient } from '@cli/services/updater/updater-api-client';
import { DockerEngineClient } from '@cli/services/updater/docker-engine-client';
import { EnvVersionFile } from '@cli/services/updater/env-version-file';
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
  static readonly ENV_SWITCH = 'ATLANTIS_UPDATER';
  /** The step text the screen recognises for a deployment that turned the updater off. */
  static readonly OFF_STEP = 'turnedOffByDeployment';

  private last: IUpdaterStatus = UpdaterService.status(UpdaterState.IDLE.value);
  /** The version this process failed to keep; never taken again automatically, whatever the api says. */
  private failedTarget = '';
  private busy = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly engine: IDockerEngine,
    private readonly api: UpdaterApiClient,
    private readonly versionFile: EnvVersionFile,
    private readonly project: string,
  ) {}

  static async fromEnvironment(): Promise<UpdaterService> {
    BootstrapSecretsService.adopt();
    const engine = new DockerEngineClient(process.env[UpdaterService.ENV_SOCKET] || DockerEngineClient.DEFAULT_SOCKET);
    // This container's own compose project names the stack it updates: a hostname is the container id.
    const self = await engine.inspect(os.hostname());
    const project = String(self.Config?.Labels?.[SelfUpdateRun.PROJECT_LABEL] ?? '');
    if (!project) throw new Error('The updater must run as a service of the platform\'s compose project.');
    return new UpdaterService(
      engine,
      new UpdaterApiClient(process.env[UpdaterService.ENV_API] || `http://api:3000${ApiVersionUtils.prefix()}`),
      new EnvVersionFile(process.env[UpdaterService.ENV_FILE] || '/app/deploy-project/.env'),
      project,
    );
  }

  start(): void {
    console.log(`[updater] watching compose project "${this.project}"`);
    void this.tick();
    this.timer = setInterval(() => { void this.tick(); }, UpdaterService.POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** `ATLANTIS_UPDATER=off` in the deployment's `.env`: this deployment is updated some other way. */
  static get turnedOff(): boolean {
    return String(process.env[UpdaterService.ENV_SWITCH] ?? '').trim().toLowerCase() === 'off';
  }

  async tick(): Promise<void> {
    if (this.busy) return;
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
    this.busy = true;
    try {
      await this.update(plan.current, plan.target);
    } finally {
      this.busy = false;
    }
  }

  private async update(from: string, to: string): Promise<void> {
    const startedAt = new Date().toISOString();
    const steps: string[] = [];
    const report = (step: string) => {
      steps.push(step);
      console.log(`[updater] ${from} -> ${to}: ${step}`);
      this.last = { ...UpdaterService.status(UpdaterState.UPDATING.value), from, to, startedAt, step, steps: [...steps] };
      void this.api.report(this.last);
    };
    const outcome = await new SelfUpdateRun(this.engine, this.api, this.versionFile, this.project, report).run(from, to)
      .catch((error: Error) => ({ state: UpdaterState.FAILED.value, error: error.message }));
    this.last = { ...this.last, state: outcome.state, error: outcome.error, finishedAt: new Date().toISOString(), step: '' };
    console.log(`[updater] ${from} -> ${to}: ${outcome.state}${outcome.error ? ` — ${outcome.error}` : ''}`);
    this.failedTarget = outcome.state === UpdaterState.SUCCEEDED.value ? '' : to;
    await this.api.reportUntilStored(this.last);
  }

  private static status(state: string): IUpdaterStatus {
    return { state, from: '', to: '', startedAt: '', finishedAt: '', step: '', steps: [], error: '' };
  }
}

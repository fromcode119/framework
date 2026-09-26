import chalk from 'chalk';
import { ComposeStack } from '@cli/services/deploy/compose-stack';
import { DeployStrategy } from '@cli/services/deploy/deploy-strategy';
import { ReleaseHealthProbe } from '@cli/services/deploy/release-health-probe';

/**
 * Replaces the apps one at a time, each new copy serving before the old one stops.
 *
 * Per app: add one container on the new image beside the running one (`--no-recreate`), wait until it
 * answers — the api must report the new VERSION, admin and frontend must answer HTTP at all — then stop
 * the old one with time to finish its requests. The gateway reaches an app by its service name, which
 * resolves to every container of it, so traffic moves as soon as the new one is up and the old one goes.
 * A new copy that never comes up is removed and the old one keeps serving: the step fails, nothing is cut.
 *
 * The gateway is restarted last and is the one blip left (a second or two): it owns the public ports.
 */
export class RollingDeploy {
  /** Longer than GracefulHttpShutdown.GRACE_MS, so the old api finishes before docker kills it. */
  static readonly STOP_GRACE_SECONDS = 30;
  private static readonly READY_TIMEOUT_MS = 240_000;
  private static readonly INTERVAL_MS = 5_000;

  constructor(
    private readonly stack: ComposeStack,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly readyTimeoutMs: number = RollingDeploy.READY_TIMEOUT_MS,
  ) {}

  async run(version: string): Promise<boolean> {
    if (!(await this.extensionHost(version))) return false;
    for (const service of DeployStrategy.ROLLED) {
      console.log(chalk.blue(`\nRolling ${service}...`));
      if (!(await this.roll(service, version))) {
        console.error(chalk.red(`${service} on ${version} did not come up; its previous container is still serving.`));
        return false;
      }
    }
    console.log(chalk.blue('\nRestarting the gateway (a second or two)...'));
    return (await this.stack.restartService('gateway')) === 0;
  }

  /**
   * The apps are scaled with `--no-deps`, so an api that starts its plugins in `extension-host` would
   * come up with nothing to connect to on the release that introduces it. It is started first when it
   * is missing — and left alone when it runs: recreating it would stop every plugin process at once,
   * the outage a rolling deploy exists to avoid. It moves to the new image on the next restart deploy.
   */
  private async extensionHost(version: string): Promise<boolean> {
    if (!(await this.stack.declared([ComposeStack.EXTENSION_HOST])).length) return true;
    const running = (await this.stack.containerIds(ComposeStack.EXTENSION_HOST)).length > 0;
    if ((await this.stack.ensure(ComposeStack.EXTENSION_HOST)) !== 0) {
      console.error(chalk.red('extension-host could not be started; nothing was rolled.'));
      return false;
    }
    console.log(running
      ? chalk.gray(`extension-host keeps running, and its plugin processes with it; it moves to ${version} on the next restart deploy.`)
      : chalk.blue('Started extension-host, where the new api starts its plugin processes.'));
    return true;
  }

  private async roll(service: string, version: string): Promise<boolean> {
    const before = await this.stack.containerIds(service);
    if ((await this.stack.scale(service, before.length + 1)) !== 0) return false;
    const fresh = (await this.stack.containerIds(service)).filter((id) => !before.includes(id));
    if (fresh.length !== 1) return false;
    if (!(await this.ready(service, fresh[0], version))) {
      await this.stack.stopAndRemove(fresh[0], RollingDeploy.STOP_GRACE_SECONDS);
      return false;
    }
    for (const old of before) await this.stack.stopAndRemove(old, RollingDeploy.STOP_GRACE_SECONDS);
    console.log(chalk.green(`${service} is on ${version}.`));
    return true;
  }

  private async ready(service: string, id: string, version: string): Promise<boolean> {
    const deadline = Date.now() + this.readyTimeoutMs;
    // Asked at least once, whatever the timeout.
    for (;;) {
      if (await this.answers(service, id, version)) return true;
      if (Date.now() >= deadline) return false;
      await this.sleep(RollingDeploy.INTERVAL_MS);
    }
  }

  /** The api by its health report (the version, not just a 200); the Next apps by answering at all. */
  private async answers(service: string, id: string, version: string): Promise<boolean> {
    if (service === 'api') {
      const body = await this.stack.probeContainer(id, `fetch('http://localhost:${ReleaseHealthProbe.API_PORT}/api/v1/health').then(r=>r.text()).then(t=>process.stdout.write(t))`);
      return ReleaseHealthProbe.reports(body, version);
    }
    const status = await this.stack.probeContainer(id, "fetch('http://localhost:3000/').then(r=>process.stdout.write(String(r.status))).catch(()=>{})");
    return /^\d{3}$/.test(status);
  }
}

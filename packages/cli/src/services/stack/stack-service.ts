import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { DeploymentTarget } from '@cli/services/deploy/deployment-target';
import { RemoteShell } from '@cli/services/deploy/remote-shell';
import { StackPlan } from '@cli/services/stack/stack-plan';
import { IStackRequest } from '@cli/services/stack/interfaces/stack-request.interface';
import { IStackRecord } from '@cli/services/stack/interfaces/stack-record.interface';
import { StackStore } from '@cli/services/stack/stack-store';

/**
 * Brings a throwaway stack up and takes it away again.
 *
 * The whole point is that `up` builds NOTHING. It runs a released image already on the machine and
 * mounts this worktree's built output over it, so a stack costs containers and a database — not
 * five three-gigabyte images, which is what a second compose project used to cost before every
 * local project was pinned to one image tag.
 */
export class StackService {
  constructor(private readonly store: StackStore = new StackStore()) {}

  /** Creates the stack's files and starts it. */
  async up(request: IStackRequest): Promise<IStackRecord> {
    this.assertFrameworkBuilt(request.framework);
    if (this.store.exists(request.name)) {
      throw new Error(`Stack "${request.name}" already exists. Use \`fromcode stack down ${request.name}\` first.`);
    }

    const plan = new StackPlan(request);
    const root = this.store.rootFor(request.name);
    this.materialise(root, request.framework, plan);
    this.store.write(request.name, request.port, request.framework, request.plugins);

    const code = await this.shell(root).stream('docker compose up -d');
    if (code !== 0) {
      throw new Error(`Stack "${request.name}" failed to start. Its files are at ${root}; \`fromcode stack down ${request.name}\` clears them.`);
    }

    const record = this.store.read(request.name);
    if (!record) throw new Error(`Stack "${request.name}" started but left no record at ${root}`);

    await this.waitUntilServing(plan, root);
    return record;
  }

  /** How long a stack is given to start serving before `up` stops waiting on it. */
  private static readonly READY_TIMEOUT_SECONDS = 120;

  /**
   * Waits for the console to actually answer.
   *
   * `docker compose up -d` returns when the containers have STARTED, which is twenty-odd seconds
   * before the platform serves anything: until the api has booted, the gateway's routing map is
   * empty (`hosts=0`) and it sends the console to the storefront, which answers 500. Reporting
   * "up" there sends someone to a broken page and makes them doubt the stack rather than wait.
   *
   * Polled with curl through the shell rather than an http client, so this adds no dependency and
   * follows the same path a person would use to check.
   */
  private async waitUntilServing(plan: StackPlan, root: string): Promise<void> {
    const url = plan.urls()[0];
    const deadline = Date.now() + StackService.READY_TIMEOUT_SECONDS * 1000;
    const shell = this.shell(root);

    while (Date.now() < deadline) {
      const probe = await shell.run(`curl -s -o /dev/null -w '%{http_code}' --max-time 5 ${url}/`);
      const status = probe.stdout.trim();
      // Anything but "nothing answered" and "the gateway has no route yet" means it is serving.
      if (status !== '000' && status !== '500' && status !== '502' && status !== '') return;

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(chalk.yellow(`  ${url} is not answering yet — the stack is up, give the api a moment.`));
  }

  /**
   * Stops the stack and removes everything it owns, its database included.
   *
   * `--volumes` is the point of the command — a stack whose data survives is not thrown away, and
   * the 15 orphaned database volumes found on 2026-11-18 are what that looks like after a month.
   */
  async down(name: string): Promise<void> {
    const record = this.store.read(name);
    if (!record) throw new Error(`No stack named "${name}". \`fromcode stack ls\` lists them.`);

    await this.shell(record.root).stream('docker compose down --volumes --remove-orphans');
    this.store.forget(name);
  }

  list(): IStackRecord[] {
    return this.store.list();
  }

  /**
   * The stacks whose owning session has been quiet long enough to call gone.
   *
   * A stack whose owner cannot be identified is never in this list. Being unable to tell is not a
   * reason to delete somebody's database — `stack ls` shows it and a person decides.
   */
  stale(): IStackRecord[] {
    return this.store.list().filter((stack) => stack.session.isStale);
  }

  /** Refuses rather than starting a stack that would serve the image's code instead of the worktree's. */
  private assertFrameworkBuilt(framework: string): void {
    if (!fs.existsSync(path.join(framework, 'packages'))) {
      throw new Error(`${framework} is not a framework checkout — it has no packages/ directory.`);
    }
    if (!fs.existsSync(path.join(framework, 'packages', 'core', 'dist'))) {
      throw new Error(
        `${framework} has not been built, so the stack would run the image's code and show none of your changes.\n` +
          '  Run `npm run build:packages` in the worktree first (and `npm run build:admin` for admin changes).',
      );
    }
  }

  /**
   * Writes the stack's directory: a copy of deploy/, the generated env, and the worktree overlay.
   *
   * The copy goes in a `deploy` SUBDIRECTORY, and compose is run from there, because the topology
   * mounts `../data`, `../plugins`, `../themes`, `../appearance`, `../public`, `../storage` and
   * `../backups` — relative to the compose file. Running from the stack's own root put all seven
   * one level above it, where every stack would have shared the same ones. The isolation this
   * command exists for would have been silently absent, and the directories outlive `down`.
   */
  private materialise(root: string, framework: string, plan: StackPlan): void {
    const source = path.join(framework, 'deploy');
    if (!fs.existsSync(source)) throw new Error(`${framework} has no deploy/ directory`);

    const deploy = StackService.deployDirOf(root);
    fs.mkdirSync(deploy, { recursive: true });
    fs.cpSync(source, deploy, { recursive: true });
    fs.writeFileSync(path.join(deploy, '.env'), plan.env());
    fs.writeFileSync(path.join(deploy, 'docker-compose.stack.yml'), plan.overlay());
  }

  /** Compose runs here, one level inside the stack, so its `../` mounts stay inside the stack. */
  static deployDirOf(root: string): string {
    return path.join(root, 'deploy');
  }

  private shell(root: string): RemoteShell {
    return new RemoteShell(DeploymentTarget.fromOptions('local', StackService.deployDirOf(root)));
  }

  /** One line per stack, for `stack ls`. */
  static describe(stack: IStackRecord): string {
    const age = Math.round((Date.now() - stack.createdAt.getTime()) / 3_600_000);
    const state = stack.session.isStale ? chalk.yellow('stale') : chalk.green('live');
    return `  ${stack.name.padEnd(16)} :${stack.port}  ${state}  ${stack.session.describe()}, up ${age}h`;
  }
}

import fs from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import { DeploymentTarget } from '@cli/services/deploy/deployment-target';
import { RemoteShell } from '@cli/services/deploy/remote-shell';
import { StackPlan } from '@cli/services/stack/stack-plan';
import { IStackRequest } from '@cli/services/stack/interfaces/stack-request.interface';
import { IStackRecord } from '@cli/services/stack/interfaces/stack-record.interface';
import { StackStore } from '@cli/services/stack/stack-store';
import { StackLayout } from '@cli/services/stack/stack-layout';
import { StackTemplate } from '@cli/services/stack/stack-template';
import { StackTemplateRestore } from '@cli/services/stack/stack-template-restore';

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

  /** Creates the stack's files and starts it, optionally from a captured template. */
  async up(request: IStackRequest, template?: string): Promise<IStackRecord> {
    this.assertFrameworkBuilt(request.framework);
    if (this.store.exists(request.name)) {
      throw new Error(`Stack "${request.name}" already exists. Use \`fromcode stack down ${request.name}\` first.`);
    }

    const plan = new StackPlan(request);
    const root = this.store.rootFor(request.name);
    this.materialise(root, request.framework, plan);
    this.store.write(request.name, request.port, request.framework, request.version, request.plugins);

    if (template) {
      await new StackTemplateRestore(this.store.root, this.shell(root)).lay(
        template,
        request.name,
        root,
        plan.urls()[0],
        await this.volumesOf(root),
      );
    }

    const code = await this.shell(root).stream('docker compose up -d');
    if (code !== 0) {
      throw new Error(`Stack "${request.name}" failed to start. Its files are at ${root}; \`fromcode stack down ${request.name}\` clears them.`);
    }

    const record = this.store.read(request.name);
    if (!record) throw new Error(`Stack "${request.name}" started but left no record at ${root}`);

    await this.waitUntilServing(plan, root);
    return record;
  }

  /** Captures a running stack so later stacks can start from it instead of the setup wizard. */
  async snapshot(stack: string, as: string): Promise<string> {
    const record = this.store.read(stack);
    if (!record) throw new Error(`No stack named "${stack}". \`fromcode stack ls\` lists them.`);

    const shell = this.shell(record.root);
    const template = new StackTemplate(StackTemplate.rootFor(this.store.root, as), shell);
    await template.capture(stack, record.version, stack, await this.volumesOf(record.root), record.root);

    return StackTemplate.rootFor(this.store.root, as);
  }

  /** The volumes this stack declares, by the logical name compose knows them under. */
  private async volumesOf(root: string): Promise<string[]> {
    const listed = await this.shell(root).runOrThrow('docker compose config --volumes');
    return listed.split('\n').map((line) => line.trim()).filter(Boolean);
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
   * Clears away a stack that never finished starting.
   *
   * Every exit from `up` has to leave the machine as it found it. A refused or failed start had
   * already claimed a port, and — when starting from a template — already created containers and
   * volumes through `compose create`. Left behind, the claim holds that port against the next
   * stack until its grace expires, which is a tool that litters while promising not to.
   *
   * Best effort by design: it runs during the handling of another failure, and the first error is
   * the one worth reporting.
   */
  async abandon(name: string, port: number): Promise<void> {
    const root = this.store.rootFor(name);

    if (fs.existsSync(StackService.deployDirOf(root))) {
      await this.shell(root).run('docker compose down --volumes --remove-orphans');
    }
    this.store.forget(name);
    this.store.releasePort(port);
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
    this.store.releasePort(record.port);
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

  /**
   * Refuses rather than starting a stack that would serve the image's code instead of the worktree's.
   *
   * It asks whether ANY workspace package has been built rather than naming one, so the check does
   * not go quiet the day that package is renamed or split.
   */
  private assertFrameworkBuilt(framework: string): void {
    StackService.assertNotSharedCheckout(framework);

    const workspaces = path.join(framework, StackLayout.of(framework).workspaces);
    if (!fs.existsSync(workspaces)) {
      throw new Error(`${framework} declares a workspace folder that is not there: ${workspaces}`);
    }

    const built = fs.readdirSync(workspaces).some((name) => fs.existsSync(path.join(workspaces, name, 'dist')));
    if (!built) {
      throw new Error(
        `${framework} has not been built, so the stack would run the image's code and show none of your changes.\n` +
          '  Run `npm run build:packages` in the worktree first (and `npm run build:admin` for admin changes).',
      );
    }
  }

  /**
   * Refuses to run the shared checkout.
   *
   * `--framework` defaults to the working directory, so running this from `framework/Source` would
   * mount the mirror of main into a container WRITABLE — the one tree no session may touch, and
   * the reason every resolved dependency is mounted read-only. A container writing there is
   * somebody's lost work, found later as a checkout that will not fast-forward.
   *
   * A worktree and its checkout are told apart by git: in the main checkout `--git-dir` and
   * `--git-common-dir` are the same directory, and in a worktree they are not.
   */
  private static assertNotSharedCheckout(framework: string): void {
    if (!StackService.isSharedCheckout(framework)) return;

    throw new Error(
      `${framework} is the shared checkout, not a worktree, and a stack would mount it writable.\n` +
        '  Cut one for this change first:\n' +
        '    git -C <checkout> fetch -q origin main\n' +
        '    git -C <checkout> worktree add -b <branch> <path> origin/main\n' +
        '  then pass it with --framework <path>.',
    );
  }

  /**
   * Whether this directory is a repository's main checkout rather than one of its worktrees.
   *
   * A directory that is not a git checkout at all answers false: there is nothing shared to
   * protect, and a stack built from a plain directory is the caller's own business.
   */
  static isSharedCheckout(framework: string): boolean {
    try {
      return StackService.gitPath(framework, '--git-dir') === StackService.gitPath(framework, '--git-common-dir');
    } catch {
      return false;
    }
  }

  /** One git path question, answered absolutely so the two can be compared. */
  private static gitPath(framework: string, question: string): string {
    const answer = execFileSync('git', ['-C', framework, 'rev-parse', question], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.resolve(framework, answer);
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
    const source = path.join(framework, StackLayout.DEPLOY_DIR);
    if (!fs.existsSync(source)) throw new Error(`${framework} has no ${StackLayout.DEPLOY_DIR}/ directory`);

    const deploy = StackService.deployDirOf(root);
    fs.mkdirSync(deploy, { recursive: true });
    fs.cpSync(source, deploy, { recursive: true });
    fs.writeFileSync(path.join(deploy, '.env'), plan.env());
    fs.writeFileSync(path.join(deploy, 'docker-compose.stack.yml'), plan.overlay());
  }

  /** Compose runs here, one level inside the stack, so its `../` mounts stay inside the stack. */
  static deployDirOf(root: string): string {
    return path.join(root, StackLayout.DEPLOY_DIR);
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

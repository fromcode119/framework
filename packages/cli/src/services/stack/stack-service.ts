import fs from 'fs';
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

    if (template) await this.layTemplate(template, request.name, root, plan.urls()[0]);

    const code = await this.shell(root).stream('docker compose up -d');
    if (code !== 0) {
      throw new Error(`Stack "${request.name}" failed to start. Its files are at ${root}; \`fromcode stack down ${request.name}\` clears them.`);
    }

    const record = this.store.read(request.name);
    if (!record) throw new Error(`Stack "${request.name}" started but left no record at ${root}`);

    await this.waitUntilServing(plan, root);
    return record;
  }

  /**
   * Puts a captured platform in place before anything runs.
   *
   * `create` rather than `up`: it makes the containers and their volumes without starting them, so
   * the database initialises from what is restored here. Started first, Postgres writes an empty
   * cluster and then refuses to take the template over it.
   */
  private async layTemplate(name: string, project: string, root: string, url: string): Promise<void> {
    const shell = this.shell(root);
    const template = new StackTemplate(StackTemplate.rootFor(this.store.root, name), shell);
    if (!StackTemplate.exists(this.store.root, name)) {
      throw new Error(`No template named "${name}". \`fromcode stack snapshot <stack> --as ${name}\` makes one.`);
    }

    await shell.runOrThrow('docker compose create');
    await template.restoreInto(root, project, await this.volumesOf(root));
    await this.adoptConsoleUrl(shell, url);
  }

  /**
   * Points the restored platform at THIS stack's console.
   *
   * A template carries the address of the stack it was captured from, and the gateway routes on it:
   * restored unchanged, the new stack answers 404 on its own hostname, because as far as the
   * platform is concerned that host belongs to nobody. Measured — a stack from a template on
   * another port was unreachable until this ran.
   *
   * Written with SQL because there is no other way in: the setting is only reachable through the
   * console, and the console is what is unreachable. The database is started alone for it, before
   * anything can read a stale value.
   */
  private async adoptConsoleUrl(shell: RemoteShell, url: string): Promise<void> {
    await shell.runOrThrow('docker compose up -d db');

    for (let attempt = 0; attempt < StackService.DATABASE_ATTEMPTS; attempt += 1) {
      const ready = await shell.run('docker compose exec -T db sh -c \'pg_isready -U "$POSTGRES_USER"\'');
      if (ready.code === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await shell.runOrThrow(StackService.consoleUrlCommand(url));
  }

  /**
   * The command that repoints the console, built where it can be read and tested.
   *
   * The statement is PIPED in, never passed as an argument: its own quotes around the URL close
   * the quoting around `sh -c`, and psql is then handed a bare `http://...` and fails on the colon.
   * The credentials come from the container's own environment, so no password appears here.
   */
  static consoleUrlCommand(url: string): string {
    const update = `update _system_meta set value = '${url}', updated_at = now() where key = 'admin_url'`;
    return `echo "${update}" | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`;
  }

  /** Seconds the restored database is given to accept connections. */
  private static readonly DATABASE_ATTEMPTS = 60;

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

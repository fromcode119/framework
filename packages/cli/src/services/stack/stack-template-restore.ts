import { RemoteShell } from '@cli/services/deploy/remote-shell';
import { StackTemplate } from '@cli/services/stack/stack-template';

/**
 * Lays a captured platform into a stack that has not started yet.
 *
 * Separate from the stack's own lifecycle because it is a different job with different failure
 * modes: the lifecycle starts and stops containers, this one puts a database in place and then has
 * to tell the restored platform which console it now answers on.
 */
export class StackTemplateRestore {
  /** How many seconds the restored database is given to accept connections. */
  private static readonly DATABASE_ATTEMPTS = 60;

  constructor(
    private readonly stacksRoot: string,
    private readonly shell: RemoteShell,
  ) {}

  /**
   * Creates the containers without starting them, restores into them, then repoints the console.
   *
   * `create` rather than `up`: it makes the containers and their volumes without starting them, so
   * the database initialises from what is restored here. Started first, Postgres writes an empty
   * cluster and then refuses to take the template over it.
   */
  async lay(name: string, project: string, root: string, url: string, volumes: readonly string[]): Promise<void> {
    if (!StackTemplate.exists(this.stacksRoot, name)) {
      throw new Error(`No template named "${name}". \`fromcode stack snapshot <stack> --as ${name}\` makes one.`);
    }
    const template = new StackTemplate(StackTemplate.rootFor(this.stacksRoot, name), this.shell);

    await this.shell.runOrThrow('docker compose create');
    await template.restoreInto(root, project, volumes);
    await this.adoptConsoleUrl(url);
  }

  /**
   * Points the restored platform at THIS stack's console.
   *
   * A template carries the address of the stack it was captured from, and the gateway routes on
   * it: restored unchanged, the new stack answers 404 on its own hostname, because as far as the
   * platform is concerned that host belongs to nobody. Measured — a stack from a template on
   * another port was unreachable until this ran.
   *
   * Written with SQL because there is no other way in: the setting is only reachable through the
   * console, and the console is what is unreachable. The database is started alone for it, before
   * anything can read a stale value.
   */
  private async adoptConsoleUrl(url: string): Promise<void> {
    await this.shell.runOrThrow('docker compose up -d db');

    for (let attempt = 0; attempt < StackTemplateRestore.DATABASE_ATTEMPTS; attempt += 1) {
      const ready = await this.shell.run('docker compose exec -T db sh -c \'pg_isready -U "$POSTGRES_USER"\'');
      if (ready.code === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await this.shell.runOrThrow(StackTemplateRestore.consoleUrlCommand(url));
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
}

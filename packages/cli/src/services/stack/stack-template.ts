import fs from 'fs';
import path from 'path';
import { RemoteShell } from '@cli/services/deploy/remote-shell';

/**
 * A ready platform, captured once and laid into every stack made from it.
 *
 * Without this a fresh stack starts empty and serves the first-run wizard: choose a database,
 * create an admin, install the extensions. There is no headless path for any of it — the CLI has
 * no command that creates a site, and `db seed` wants a seed file the framework does not ship — so
 * every throwaway stack cost a trip through the browser, which is most of the reason nobody made
 * one.
 *
 * It copies VOLUMES rather than taking a SQL dump, and that is the whole design. `data/database.json`
 * stores full connection URLs, and for the bundled database those carry passwords for roles that
 * exist only inside that Postgres. A `pg_dump` restores the rows but not the roles; `pg_dumpall`
 * restores the roles but also the superuser's password, which no longer matches the password file
 * the new stack generated. Copying the cluster and the password file together keeps all three in
 * agreement, and is a file copy rather than a database operation.
 */
export class StackTemplate {
  /** Templates live beside the stacks, under a dot so a template is never mistaken for one. */
  static readonly DIRECTORY = '.templates';

  /** The host directory the topology mounts as the platform's data. */
  private static readonly DATA = 'data';

  /**
   * The helper that reads and writes a volume's contents.
   *
   * The database image, because the stack already runs it — naming any other image here would be a
   * pull the first time a template is ever made.
   */
  private static readonly HELPER_IMAGE = 'postgres:15-alpine';

  constructor(
    private readonly root: string,
    private readonly shell: RemoteShell,
  ) {}

  static rootFor(stacksRoot: string, name: string): string {
    return path.join(stacksRoot, StackTemplate.DIRECTORY, name);
  }

  /** The tag a named template was captured on, or null when there is no such template. */
  static versionAt(stacksRoot: string, name: string): string | null {
    const file = path.join(StackTemplate.rootFor(stacksRoot, name), 'template.json');
    if (!fs.existsSync(file)) return null;
    return String((JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string }).version || '') || null;
  }

  static exists(stacksRoot: string, name: string): boolean {
    return fs.existsSync(path.join(StackTemplate.rootFor(stacksRoot, name), 'template.json'));
  }

  /**
   * Captures a stack as a template.
   *
   * The stack is stopped first. A Postgres data directory copied while the server is writing to it
   * is a torn copy that may or may not replay — and it would fail later, in somebody else's stack,
   * looking like anything but this.
   */
  async capture(stack: string, version: string, project: string, volumes: readonly string[], stackRoot: string): Promise<void> {
    fs.mkdirSync(this.root, { recursive: true });

    await this.shell.runOrThrow('docker compose stop');
    try {
      await this.shell.runOrThrow(`tar -C ${path.join(stackRoot, StackTemplate.DATA)} -cf ${this.archiveFor(StackTemplate.DATA)} .`);
      for (const volume of volumes) await this.saveVolume(project, volume);
    } finally {
      await this.shell.run('docker compose start');
    }

    fs.writeFileSync(
      path.join(this.root, 'template.json'),
      `${JSON.stringify({ stack, version, volumes, capturedAt: new Date().toISOString() }, null, 2)}\n`,
    );
  }

  /**
   * Lays the template into a stack whose containers exist but have never run.
   *
   * The caller must have created them without starting them, so that the database initialises from
   * what is restored here rather than from an empty directory it would then refuse to overwrite.
   */
  async restoreInto(stackRoot: string, project: string, volumes: readonly string[]): Promise<void> {
    const data = path.join(stackRoot, StackTemplate.DATA);
    fs.mkdirSync(data, { recursive: true });
    await this.shell.runOrThrow(`tar -C ${data} -xf ${this.archiveFor(StackTemplate.DATA)}`);

    for (const volume of volumes) await this.loadVolume(project, volume);
  }

  /** The version the template was captured from, so a mismatch can be reported. */
  get version(): string {
    const file = path.join(this.root, 'template.json');
    if (!fs.existsSync(file)) return '';

    return String((JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string }).version || '');
  }

  /** The volume names the template holds, which a restore must be given in the same shape. */
  get volumes(): string[] {
    const file = path.join(this.root, 'template.json');
    if (!fs.existsSync(file)) return [];

    return (JSON.parse(fs.readFileSync(file, 'utf8')) as { volumes?: string[] }).volumes ?? [];
  }

  private archiveFor(name: string): string {
    return path.join(this.root, `${name}.tar`);
  }

  /**
   * Compose declares volumes by a LOGICAL name and creates them prefixed with the project, so the
   * two are kept apart here: the archive is named by the logical name, which is the same in every
   * stack, and only the lookup uses the prefix. Deriving one from the other by stripping up to the
   * first underscore breaks on any project whose own name contains one.
   */
  private static volumeOf(project: string, logical: string): string {
    return `${project}_${logical}`;
  }

  /** A volume is read through a throwaway container, because the host cannot reach it directly. */
  private async saveVolume(project: string, logical: string): Promise<void> {
    await this.shell.runOrThrow(
      `docker run --rm -v ${StackTemplate.volumeOf(project, logical)}:/from:ro -v ${this.root}:/to ` +
        `${StackTemplate.HELPER_IMAGE} tar -C /from -cf /to/${logical}.tar .`,
    );
  }

  private async loadVolume(project: string, logical: string): Promise<void> {
    await this.shell.runOrThrow(
      `docker run --rm -v ${StackTemplate.volumeOf(project, logical)}:/to -v ${this.root}:/from:ro ` +
        `${StackTemplate.HELPER_IMAGE} tar -C /to -xf /from/${logical}.tar`,
    );
  }
}

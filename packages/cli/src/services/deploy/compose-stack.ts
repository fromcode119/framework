import { RemoteShell } from '@cli/services/deploy/remote-shell';

/**
 * The compose stack on the target.
 *
 * Both files, always. The base file declares `build:` sections, so invoking it alone rebuilds from
 * source instead of using the published image — `docker-compose.images.yml` resets those to `null`,
 * and a pull without it reports "No image to be pulled" and changes nothing while looking like it
 * worked.
 */
export class ComposeStack {
  /**
   * The gateway is in this list because it was silently left out of it.
   *
   * It is published as an image like the other three, so a deploy could always have updated it — it
   * simply was never asked to, and the consequence is invisible: every release moved api, admin and
   * frontend while the edge every hostname passes through stayed on whatever version it was last
   * started with. Routing and TLS changes shipped to a container nobody restarted.
   */
  static readonly SERVICES = ['api', 'admin', 'frontend', 'gateway'];

  private static readonly FILES = '-f docker-compose.full-stack.yml -f docker-compose.images.yml';

  constructor(private readonly shell: RemoteShell) {}

  async pull(version: string): Promise<number> {
    return this.shell.stream(`VERSION=${version} docker compose ${ComposeStack.FILES} pull ${ComposeStack.SERVICES.join(' ')}`);
  }

  async up(): Promise<number> {
    return this.shell.stream(`docker compose ${ComposeStack.FILES} up -d ${ComposeStack.SERVICES.join(' ')}`);
  }

  /**
   * Asked INSIDE the api container, on its own port.
   *
   * The api publishes no host port on a box with a proxy in front, so a check against the host
   * answers nothing; going through the public URL would test the certificate and the proxy as much
   * as the release, and can serve a cached answer from the version being replaced.
   */
  async health(port: number): Promise<string> {
    const probe = `fetch('http://localhost:${port}/api/v1/health').then(r=>r.text()).then(t=>process.stdout.write(t))`;
    const result = await this.shell.run(`docker compose ${ComposeStack.FILES} exec -T api node -e "${probe}"`);
    return result.stdout.trim();
  }

  /** Container ids of one service, oldest first as compose lists them. */
  async containerIds(service: string): Promise<string[]> {
    const result = await this.shell.run(`docker compose ${ComposeStack.FILES} ps -q ${service}`);
    return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  /**
   * Adds instances of one service WITHOUT touching the running ones: `--no-recreate` keeps the old
   * container on its old image, so the added one is the only container on the new version.
   */
  async scale(service: string, count: number): Promise<number> {
    return this.shell.stream(`docker compose ${ComposeStack.FILES} up -d --no-deps --no-recreate --scale ${service}=${count} ${service}`);
  }

  /** Runs a node one-liner inside ONE container; the answer is its stdout. */
  async probeContainer(id: string, script: string): Promise<string> {
    const result = await this.shell.run(`docker exec ${id} node -e "${script}"`);
    return result.code === 0 ? result.stdout.trim() : '';
  }

  /** SIGTERM, then up to `graceSeconds` for the requests in flight to finish, then gone. */
  async stopAndRemove(id: string, graceSeconds: number): Promise<number> {
    return this.shell.stream(`docker stop -t ${graceSeconds} ${id} && docker rm ${id}`);
  }

  async restartService(service: string): Promise<number> {
    return this.shell.stream(`docker compose ${ComposeStack.FILES} up -d --no-deps ${service}`);
  }

  /** One read-only query against the platform database, as its owner, inside the db container. */
  async query(sql: string): Promise<string> {
    const result = await this.shell.run(`echo "${sql}" | docker compose ${ComposeStack.FILES} exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'`);
    return result.code === 0 ? result.stdout.trim() : '';
  }

  /** The core migration files shipped in the api image of the version `.env` now names. */
  async migrationFiles(): Promise<string[]> {
    const result = await this.shell.run(`docker compose ${ComposeStack.FILES} run --rm --no-deps -T --entrypoint ls api /app/packages/core/dist/database/migrations`);
    return result.code === 0 ? result.stdout.split('\n').map((line) => line.trim()).filter(Boolean) : [];
  }

  async apiLogs(lines: number): Promise<string> {
    const result = await this.shell.run(`docker compose ${ComposeStack.FILES} logs --tail ${lines} api`);
    return result.stdout + result.stderr;
  }
}

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

  /**
   * Services a release MAY declare. Asked for only when the compose files name them: compose refuses a
   * service it does not know, and a rollback to a release from before one existed must still pull.
   */
  static readonly OPTIONAL = ['extension-host', 'edge'];

  static readonly EXTENSION_HOST = 'extension-host';
  /** Holds the public ports in front of the gateway, so the gateway can be rolled like the apps. */
  static readonly EDGE = 'edge';
  /** The ports those two listen on for plain HTTP inside their containers (`EDGE_HTTP_PORT`, the gateway's). */
  static readonly EDGE_HTTP_PORT = 80;
  static readonly GATEWAY_HTTP_PORT = 3000;

  private static readonly FILES = '-f docker-compose.full-stack.yml -f docker-compose.images.yml';

  constructor(private readonly shell: RemoteShell) {}

  async pull(version: string): Promise<number> {
    return this.shell.stream(`VERSION=${version} docker compose ${ComposeStack.FILES} pull ${(await this.services()).join(' ')}`);
  }

  async up(): Promise<number> {
    return this.shell.stream(`docker compose ${ComposeStack.FILES} up -d ${(await this.services()).join(' ')}`);
  }

  /** The apps, plus each optional service the synced compose files declare. */
  async services(): Promise<string[]> {
    return [...ComposeStack.SERVICES, ...(await this.declared(ComposeStack.OPTIONAL))];
  }

  /**
   * Which of `services` the compose files declare.
   *
   * With every profile: `config --services` otherwise omits a service behind a profile, and `gateway`
   * and `edge` both are. Without it, the release that introduced the edge was read as not declaring
   * one — the deploy rolled, recreated the gateway without its public ports, never started the edge,
   * and every site answered 521 until a person started it.
   */
  async declared(services: readonly string[]): Promise<string[]> {
    const result = await this.shell.run(`docker compose ${ComposeStack.FILES} --profile '*' config --services`);
    const listed = new Set(result.stdout.split('\n').map((line) => line.trim()).filter(Boolean));
    return services.filter((service) => listed.has(service));
  }

  /** Starts `service` when it is not running; one that is keeps running exactly as it is. */
  async ensure(service: string): Promise<number> {
    return this.shell.stream(`docker compose ${ComposeStack.FILES} up -d --no-deps --no-recreate ${service}`);
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

  /**
   * The address visitors reach the platform on, as published on this box: the edge's HTTP port when an
   * edge runs, the gateway's own otherwise. Null when neither publishes one.
   */
  async publicAddress(): Promise<string | null> {
    const front = (await this.containerIds(ComposeStack.EDGE)).length
      ? { service: ComposeStack.EDGE, port: ComposeStack.EDGE_HTTP_PORT }
      : { service: 'gateway', port: ComposeStack.GATEWAY_HTTP_PORT };
    const result = await this.shell.run(`docker compose ${ComposeStack.FILES} port ${front.service} ${front.port}`);
    return result.code === 0 ? ComposeStack.reachable(result.stdout.trim()) : null;
  }

  /** `0.0.0.0:80` → `127.0.0.1:80`, `[::]:80` → `[::1]:80`: a wildcard bind is reached on loopback. */
  static reachable(published: string): string | null {
    const match = /^(.*):(\d+)$/.exec(published);
    if (!match || match[2] === '0') return null;
    const host = match[1] === '0.0.0.0' ? '127.0.0.1' : match[1] === '[::]' || match[1] === '::' ? '[::1]' : match[1];
    return `${host}:${match[2]}`;
  }

  /** The HTTP status the public address answers with ('000' when nothing answers). */
  async publicStatus(address: string): Promise<string> {
    const result = await this.shell.run(`curl -s -o /dev/null -m 5 -w '%{http_code}' http://${address}/`);
    return result.stdout.trim() || '000';
  }

  async apiLogs(lines: number): Promise<string> {
    const result = await this.shell.run(`docker compose ${ComposeStack.FILES} logs --tail ${lines} api`);
    return result.stdout + result.stderr;
  }
}

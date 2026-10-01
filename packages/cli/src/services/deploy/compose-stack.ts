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
  static readonly OPTIONAL = ['extension-host', 'site-extension-host', 'edge'];

  static readonly EXTENSION_HOST = 'extension-host';
  /** Where plugins a SITE uploads run, sandboxed, apart from the platform's (a release may declare it). */
  static readonly SITE_EXTENSION_HOST = 'site-extension-host';
  /** Every service that runs plugin processes; each is started first and rolled last, with no gap. */
  static readonly EXTENSION_HOSTS = [ComposeStack.EXTENSION_HOST, ComposeStack.SITE_EXTENSION_HOST];
  /** Holds the public ports in front of the gateway, so the gateway can be rolled like the apps. */
  static readonly EDGE = 'edge';
  /** The ports those two listen on for plain HTTP inside their containers (`EDGE_HTTP_PORT`, the gateway's). */
  static readonly EDGE_HTTP_PORT = 80;
  static readonly GATEWAY_HTTP_PORT = 3000;

  /** Always used, first: the stack and the published images. */
  static readonly REQUIRED_FILES = ['docker-compose.full-stack.yml', 'docker-compose.images.yml'];

  private flagsResolved: Promise<string> | null = null;

  constructor(private readonly shell: RemoteShell) {}

  /**
   * `-f` for each compose file of this box: the required two, then whatever else its `.env` names in
   * `COMPOSE_FILE` (the pdf renderer's file, on a box that runs one). Passing only the two made every
   * deploy call the box's own `pdf-renderer` an orphan — a `--remove-orphans` away from deleting it.
   */
  private flags(): Promise<string> {
    this.flagsResolved ??= this.shell.run("sed -n 's/^COMPOSE_FILE=//p' .env").then((result) =>
      ComposeStack.filesFrom(result.code === 0 ? result.stdout : '').map((file) => `-f ${file}`).join(' '));
    return this.flagsResolved;
  }

  /** The required files, then each other one `COMPOSE_FILE` lists, once, in its order. */
  static filesFrom(composeFile: string): string[] {
    const listed = composeFile.trim().replace(/^['"]|['"]$/g, '').split(':').map((file) => file.trim()).filter((file) => /^[\w.\/-]+\.ya?ml$/.test(file));
    return [...ComposeStack.REQUIRED_FILES, ...listed.filter((file, index) => !ComposeStack.REQUIRED_FILES.includes(file) && listed.indexOf(file) === index)];
  }

  async pull(version: string): Promise<number> {
    return this.shell.stream(`VERSION=${version} docker compose ${await this.flags()} pull ${(await this.services()).join(' ')}`);
  }

  async up(): Promise<number> {
    return this.shell.stream(`docker compose ${await this.flags()} up -d ${(await this.services()).join(' ')}`);
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
    const result = await this.shell.run(`docker compose ${await this.flags()} --profile '*' config --services`);
    const listed = new Set(result.stdout.split('\n').map((line) => line.trim()).filter(Boolean));
    return services.filter((service) => listed.has(service));
  }

  /** Starts `service` when it is not running; one that is keeps running exactly as it is. */
  async ensure(service: string): Promise<number> {
    return this.shell.stream(`docker compose ${await this.flags()} up -d --no-deps --no-recreate ${service}`);
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
    const result = await this.shell.run(`docker compose ${await this.flags()} exec -T api node -e "${probe}"`);
    return result.stdout.trim();
  }

  /** Container ids of one service, oldest first as compose lists them. */
  async containerIds(service: string): Promise<string[]> {
    const result = await this.shell.run(`docker compose ${await this.flags()} ps -q ${service}`);
    return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  /**
   * Adds instances of one service WITHOUT touching the running ones: `--no-recreate` keeps the old
   * container on its old image, so the added one is the only container on the new version.
   */
  async scale(service: string, count: number): Promise<number> {
    return this.shell.stream(`docker compose ${await this.flags()} up -d --no-deps --no-recreate --scale ${service}=${count} ${service}`);
  }

  /** Runs a node one-liner inside ONE container; the answer is its stdout. */
  async probeContainer(id: string, script: string): Promise<string> {
    const result = await this.shell.run(`docker exec ${id} node -e "${script}"`);
    return result.code === 0 ? result.stdout.trim() : '';
  }

  /** The image one container runs, as compose named it (`ghcr.io/…/framework-api:v0.2.218`). */
  async imageOf(id: string): Promise<string> {
    const result = await this.shell.run(`docker inspect -f '{{.Config.Image}}' ${id}`);
    return result.code === 0 ? result.stdout.trim() : '';
  }

  /** The last lines one container printed. */
  async logsOf(id: string, lines = 50): Promise<string> {
    const result = await this.shell.run(`docker logs --tail ${lines} ${id} 2>&1`);
    return result.stdout;
  }

  /**
   * How many processes in one container run as a plugin's own OS user (uid at or above `uidBase`), or
   * null when it cannot be told. `docker top` refuses a column list without `pid`, and a count that failed
   * must never read as "none left" — the old extension-host would be removed with plugins still in it.
   */
  async processesFromUid(id: string, uidBase: number): Promise<number | null> {
    const result = await this.shell.run(`docker top ${id} -eo pid,uid`);
    if (result.code !== 0) return null;
    return result.stdout.split('\n').slice(1)
      .map((line) => Number(line.trim().split(/\s+/)[1]))
      .filter((uid) => Number.isInteger(uid) && uid >= uidBase).length;
  }

  /** SIGTERM, then up to `graceSeconds` for the requests in flight to finish, then gone. */
  async stopAndRemove(id: string, graceSeconds: number): Promise<number> {
    return this.shell.stream(`docker stop -t ${graceSeconds} ${id} && docker rm ${id}`);
  }

  async restartService(service: string): Promise<number> {
    return this.shell.stream(`docker compose ${await this.flags()} up -d --no-deps ${service}`);
  }

  /** One read-only query against the platform database, as its owner, inside the db container. */
  async query(sql: string): Promise<string> {
    const result = await this.shell.run(`echo "${sql}" | docker compose ${await this.flags()} exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'`);
    return result.code === 0 ? result.stdout.trim() : '';
  }

  /** The core migration files shipped in the api image of the version `.env` now names. */
  async migrationFiles(): Promise<string[]> {
    const result = await this.shell.run(`docker compose ${await this.flags()} run --rm --no-deps -T --entrypoint ls api /app/packages/core/dist/database/migrations`);
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
    const result = await this.shell.run(`docker compose ${await this.flags()} port ${front.service} ${front.port}`);
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
    const result = await this.shell.run(`docker compose ${await this.flags()} logs --tail ${lines} api`);
    return result.stdout + result.stderr;
  }
}

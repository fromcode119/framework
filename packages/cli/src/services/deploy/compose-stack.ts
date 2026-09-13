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

  async apiLogs(lines: number): Promise<string> {
    const result = await this.shell.run(`docker compose ${ComposeStack.FILES} logs --tail ${lines} api`);
    return result.stdout + result.stderr;
  }
}

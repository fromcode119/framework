import http from 'http';
import type { IContainerInspect } from '@cli/services/updater/interfaces/container-inspect.interface';
import type { IContainerSummary } from '@cli/services/updater/interfaces/container-summary.interface';
import type { IDockerEngine } from '@cli/services/updater/interfaces/docker-engine.interface';
import type { IImageDefaults } from '@cli/services/updater/interfaces/image-defaults.interface';

/**
 * The Docker Engine API over the daemon's unix socket — the socket the updater service has mounted.
 *
 * Plain HTTP on a socket rather than the `docker` binary: the platform images do not ship a Docker CLI,
 * and the API is the contract the CLI itself is built on, so nothing new has to be installed for this.
 */
export class DockerEngineClient implements IDockerEngine {
  static readonly DEFAULT_SOCKET = '/var/run/docker.sock';
  private static readonly API_VERSION = 'v1.41';
  /** Pulling a platform image on a slow line takes minutes; anything else answers in seconds. */
  private static readonly PULL_TIMEOUT_MS = 30 * 60 * 1000;
  private static readonly TIMEOUT_MS = 2 * 60 * 1000;

  constructor(private readonly socketPath: string = DockerEngineClient.DEFAULT_SOCKET) {}

  async listContainers(labels: string[]): Promise<IContainerSummary[]> {
    const filters = encodeURIComponent(JSON.stringify({ label: labels }));
    return this.json('GET', `/containers/json?all=true&filters=${filters}`);
  }

  async inspect(id: string): Promise<IContainerInspect> {
    return this.json('GET', `/containers/${encodeURIComponent(id)}/json`);
  }

  async imageDefaults(reference: string): Promise<IImageDefaults> {
    const image = await this.json<any>('GET', `/images/${encodeURIComponent(reference)}/json`);
    const config = image?.Config ?? {};
    return { Env: config.Env ?? [], Cmd: config.Cmd ?? null, Entrypoint: config.Entrypoint ?? null, WorkingDir: config.WorkingDir ?? '' };
  }

  async hasImage(reference: string): Promise<boolean> {
    const { status } = await this.request('GET', `/images/${encodeURIComponent(reference)}/json`, undefined, DockerEngineClient.TIMEOUT_MS);
    return status === 200;
  }

  /**
   * The pull endpoint answers 200 at once and then streams progress; a failure arrives as an `error`
   * line INSIDE that stream. So the whole stream is read, and its last error is the answer.
   */
  async pull(repository: string, tag: string): Promise<string | null> {
    const path = `/images/create?fromImage=${encodeURIComponent(repository)}&tag=${encodeURIComponent(tag)}`;
    const { status, body } = await this.request('POST', path, undefined, DockerEngineClient.PULL_TIMEOUT_MS);
    if (status >= 400) return DockerEngineClient.message(body) || `pull answered ${status}`;
    const errors = body.split('\n').map((line) => { try { return JSON.parse(line)?.error; } catch { return undefined; } }).filter(Boolean);
    return errors.length ? String(errors[errors.length - 1]) : null;
  }

  async createContainer(name: string, body: Record<string, any>): Promise<string> {
    const created = await this.json<{ Id: string }>('POST', `/containers/create?name=${encodeURIComponent(name)}`, body);
    return created.Id;
  }

  async connectNetwork(network: string, containerId: string, endpoint: Record<string, any>): Promise<void> {
    await this.json('POST', `/networks/${encodeURIComponent(network)}/connect`, { Container: containerId, EndpointConfig: endpoint });
  }

  async start(id: string): Promise<void> {
    await this.json('POST', `/containers/${encodeURIComponent(id)}/start`);
  }

  async stop(id: string, timeoutSeconds: number): Promise<void> {
    await this.json('POST', `/containers/${encodeURIComponent(id)}/stop?t=${timeoutSeconds}`);
  }

  async rename(id: string, name: string): Promise<void> {
    await this.json('POST', `/containers/${encodeURIComponent(id)}/rename?name=${encodeURIComponent(name)}`);
  }

  async remove(id: string): Promise<void> {
    await this.json('DELETE', `/containers/${encodeURIComponent(id)}?force=true`);
  }

  async listImages(): Promise<string[]> {
    const images = await this.json<Array<{ RepoTags?: string[] | null }>>('GET', '/images/json');
    return images.flatMap((image) => image.RepoTags ?? []).filter((tag) => tag && tag !== '<none>:<none>');
  }

  async removeImage(reference: string): Promise<void> {
    await this.json('DELETE', `/images/${encodeURIComponent(reference)}`);
  }

  /** 304 (already started / already stopped) is success: the container is where it was asked to be. */
  private async json<T = unknown>(method: string, path: string, payload?: unknown): Promise<T> {
    const { status, body } = await this.request(method, path, payload, DockerEngineClient.TIMEOUT_MS);
    if (status >= 400) throw new Error(`${method} ${path.split('?')[0]}: ${DockerEngineClient.message(body) || status}`);
    return (body ? JSON.parse(body) : undefined) as T;
  }

  private request(method: string, path: string, payload: unknown, timeoutMs: number): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const data = payload === undefined ? undefined : JSON.stringify(payload);
      const req = http.request({
        socketPath: this.socketPath,
        path: `/${DockerEngineClient.API_VERSION}${path}`,
        method,
        headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
        timeout: timeoutMs,
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on('timeout', () => req.destroy(new Error(`${method} ${path.split('?')[0]} timed out`)));
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  private static message(body: string): string {
    try { return String(JSON.parse(body)?.message ?? ''); } catch { return body.trim(); }
  }
}

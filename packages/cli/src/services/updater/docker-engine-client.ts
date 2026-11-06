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

  async exec(id: string, cmd: string[]): Promise<{ code: number; stdout: string }> {
    const created = await this.json<{ Id: string }>('POST', `/containers/${encodeURIComponent(id)}/exec`, { AttachStdout: true, AttachStderr: true, Cmd: cmd });
    const { status, body } = await this.request('POST', `/exec/${created.Id}/start`, { Detach: false, Tty: false }, DockerEngineClient.TIMEOUT_MS, true);
    if (status >= 400) return { code: 1, stdout: '' };
    const inspected = await this.json<{ ExitCode: number | null }>('GET', `/exec/${created.Id}/json`);
    return { code: inspected.ExitCode ?? 1, stdout: DockerEngineClient.demux(body as Buffer, 1) };
  }

  async logs(id: string, tail: number): Promise<string> {
    const { status, body } = await this.request('GET', `/containers/${encodeURIComponent(id)}/logs?stdout=1&stderr=1&tail=${tail}`, undefined, DockerEngineClient.TIMEOUT_MS, true);
    return status >= 400 ? '' : DockerEngineClient.demux(body as Buffer);
  }

  async top(id: string, psArgs: string): Promise<{ Titles: string[]; Processes: string[][] }> {
    return this.json('GET', `/containers/${encodeURIComponent(id)}/top?ps_args=${encodeURIComponent(psArgs)}`);
  }

  /** `docker stats` shows usage minus the inactive page cache (cgroup v2 `inactive_file`, v1 `total_inactive_file`). */
  async memoryUsage(id: string): Promise<number> {
    const stats = await this.json<any>('GET', `/containers/${encodeURIComponent(id)}/stats?stream=false`);
    const memory = stats?.memory_stats ?? {};
    const cache = Number(memory.stats?.inactive_file ?? memory.stats?.total_inactive_file ?? 0) || 0;
    return Math.max(0, (Number(memory.usage) || 0) - cache);
  }

  async wait(id: string): Promise<number> {
    const { body } = await this.request('POST', `/containers/${encodeURIComponent(id)}/wait`, undefined, DockerEngineClient.PULL_TIMEOUT_MS);
    try { return Number(JSON.parse(String(body))?.StatusCode ?? 1); } catch { return 1; }
  }

  /**
   * A container without a TTY answers logs and exec output as frames: one byte naming the stream
   * (1 stdout, 2 stderr), three zero bytes, a big-endian length, then that many bytes. Output that does
   * not frame that way (a container started with a TTY) is returned as it came.
   */
  static demux(raw: Buffer, onlyStream?: number): string {
    const parts: Buffer[] = [];
    let offset = 0;
    while (offset + 8 <= raw.length) {
      const stream = raw[offset];
      if (stream > 2 || raw[offset + 1] || raw[offset + 2] || raw[offset + 3]) return raw.toString('utf8');
      const size = raw.readUInt32BE(offset + 4);
      if (onlyStream === undefined || stream === onlyStream) parts.push(raw.subarray(offset + 8, offset + 8 + size));
      offset += 8 + size;
    }
    return offset === raw.length ? Buffer.concat(parts).toString('utf8') : raw.toString('utf8');
  }

  /** 304 (already started / already stopped) is success: the container is where it was asked to be. */
  private async json<T = unknown>(method: string, path: string, payload?: unknown): Promise<T> {
    const { status, body } = await this.request(method, path, payload, DockerEngineClient.TIMEOUT_MS);
    if (status >= 400) throw new Error(`${method} ${path.split('?')[0]}: ${DockerEngineClient.message(body) || status}`);
    return (body ? JSON.parse(body) : undefined) as T;
  }

  private request(method: string, path: string, payload: unknown, timeoutMs: number): Promise<{ status: number; body: string }>;
  private request(method: string, path: string, payload: unknown, timeoutMs: number, raw: true): Promise<{ status: number; body: Buffer }>;
  private request(method: string, path: string, payload: unknown, timeoutMs: number, raw = false): Promise<{ status: number; body: string | Buffer }> {
    return new Promise((resolve, reject) => {
      const data = payload === undefined ? undefined : JSON.stringify(payload);
      const req = http.request({
        socketPath: this.socketPath,
        path: `/${DockerEngineClient.API_VERSION}${path}`,
        method,
        headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
        timeout: timeoutMs,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => { chunks.push(chunk); });
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({ status: res.statusCode ?? 0, body: raw ? body : body.toString('utf8') });
        });
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

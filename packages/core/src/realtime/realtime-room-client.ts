import { ApiPathUtils } from '@core/api/api-path-utils';
import { RouteConstants } from '@core/constants/route.constants';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';

/**
 * A browser listening to one realtime room — the other end of `context.realtime`.
 *
 * The plugin's own endpoint decides who may listen and returns a room token; `tokenFor` fetches one.
 * It is asked again on every reconnect, because a token admits a connection only until it expires,
 * and a chat left open over lunch has outlived it. The socket is opened on the page's own origin:
 * every host the platform serves hands `/api/*` to the api, so a storefront reaches it like a console.
 *
 * Listening only. What the browser says goes through the plugin's routes, which know who it is.
 */
export class RealtimeRoomClient {
  /** Waits between attempts after a drop, the last repeated — so a restarting api is not stampeded. */
  private static readonly RETRY_DELAYS_MS: readonly number[] = [1_000, 2_000, 5_000, 10_000, 30_000];
  private static readonly READY = 'system:ready';

  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closed = false;
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();

  constructor(
    private readonly tokenFor: () => Promise<string>,
    private readonly options: { onConnectionChange?(connected: boolean): void } = {},
  ) {}

  /** Start listening. Reconnects on its own until {@link close}. */
  open(): this {
    this.closed = false;
    if (!this.socket && !this.retry) void this.connect();
    return this;
  }

  /** Call `handler` with the payload of every event of `type`. Returns the way to stop. */
  on(type: string, handler: (payload: unknown) => void): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  close(): void {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  /**
   * Where the socket is served: under the VERSIONED api path, because that is what every host hands to
   * the api. The api's upgrade handler reads this same method, so the two cannot drift apart.
   */
  static socketPath(): string {
    return ApiPathUtils.versioned(RouteConstants.SEGMENTS.WEBSOCKET);
  }

  /** `ws(s)://<this page's origin>/api/<version>/socket?room=<token>` */
  static socketUrl(token: string): string {
    const http = ApplicationUrlUtils.joinApiPath(ApplicationUrlUtils.inferBrowserBaseUrl(), RealtimeRoomClient.socketPath());
    const url = new URL(http, window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('room', token);
    return url.toString();
  }

  private async connect(): Promise<void> {
    let token = '';
    try {
      token = await this.tokenFor();
    } catch {
      token = '';
    }
    if (this.closed) return;
    if (!token) {
      this.scheduleRetry();
      return;
    }
    const socket = new WebSocket(RealtimeRoomClient.socketUrl(token));
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.attempts = 0;
      this.options.onConnectionChange?.(true);
    });
    socket.addEventListener('message', (event) => this.dispatch(String(event.data ?? '')));
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.options.onConnectionChange?.(false);
      if (!this.closed) this.scheduleRetry();
    });
  }

  private dispatch(data: string): void {
    let message: { type?: unknown; payload?: unknown };
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    const type = String(message?.type ?? '');
    if (!type || type === RealtimeRoomClient.READY) return;
    for (const handler of this.handlers.get(type) ?? []) handler(message.payload);
  }

  private scheduleRetry(): void {
    const delays = RealtimeRoomClient.RETRY_DELAYS_MS;
    const wait = delays[Math.min(this.attempts, delays.length - 1)];
    this.attempts += 1;
    this.retry = setTimeout(() => {
      this.retry = null;
      if (!this.closed) void this.connect();
    }, wait);
  }
}

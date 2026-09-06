/**
 * Registers this plugin into a PEER plugin's registry whenever the peer becomes reachable.
 *
 * A peer's namespace API is not always resolvable at the moment a plugin boots: the peer may register
 * later in the boot order, and on a multi-tenant deployment the namespace resolves peers only inside
 * a request. So the same registration is attempted at boot, again once every plugin is registered
 * (`plugins:ready`), and again on this plugin's first request — and it runs exactly once. The helper
 * knows nothing about what is registered: the caller passes the peer's slug and the call to make.
 */
export class PluginPeerRegistration {
  private static readonly PLUGINS_READY_EVENT = 'plugins:ready';
  private done = false;

  private constructor(
    private readonly context: any,
    private readonly namespace: string,
    private readonly peerSlug: string,
    private readonly register: (peerApi: any) => Promise<void>,
    private readonly label: string,
  ) {}

  /** Wire all three attempts. Call from `onInit` (the middleware must be mounted before the plugin's routers). */
  static install(context: any, input: { namespace: string; peerSlug: string; label: string; register: (peerApi: any) => Promise<void> }): PluginPeerRegistration {
    const registration = new PluginPeerRegistration(context, input.namespace, input.peerSlug, input.register, input.label);
    // AWAITED, both of them. Under process isolation every call to a peer carries the token of the
    // invocation it runs in, and that token is revoked the moment the invocation returns. A
    // fire-and-forget attempt raced the end of the request (a /health answer beat it) or of the
    // plugins:ready hook, and lost with "unknown_invocation" — the providers simply never appeared.
    // Once `done`, the middleware short-circuits, so the await costs nothing after the first success.
    context.api.use('/', async (_req: unknown, _res: unknown, next: () => void) => { await registration.attempt('request'); next(); });
    context.plugins.on(PluginPeerRegistration.PLUGINS_READY_EVENT, () => registration.attempt('plugins:ready'));
    void registration.attempt('boot');
    return registration;
  }

  /** Try once now; safe to call repeatedly. Returns true when the registration has happened (now or earlier). */
  async attempt(moment: string): Promise<boolean> {
    // `plugins:ready` fires again when a PEER's process was replaced (an update, a crash): its memory is
    // new, so what was registered into it must be registered again. Every other moment is idempotent.
    if (this.done && moment !== PluginPeerRegistration.PLUGINS_READY_EVENT) return true;
    const peer = (this.context.plugins.namespace(this.namespace) as Record<string, any>)?.[this.peerSlug];
    if (!peer) return false;
    try {
      await this.register(peer);
      this.done = true;
      this.context.logger.info(`[${this.context.plugin.slug}] ${this.label} registered with ${this.peerSlug} (${moment})`);
      return true;
    } catch (error) {
      this.context.logger.warn(`[${this.context.plugin.slug}] ${this.label} registration with ${this.peerSlug} failed (${moment}): ${String((error as any)?.message || error)}`);
      return false;
    }
  }
}

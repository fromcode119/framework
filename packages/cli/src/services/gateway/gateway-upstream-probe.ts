import http from 'http';

/**
 * Tells the gateway's watchdog when the gateway itself is what stops requests reaching the frontend.
 *
 * On 2026-11-24 every storefront page hung for 15-30 s (then aborted) while the frontend answered the
 * same request in under 200 ms from inside the gateway's own container, and the gateway's health path
 * answered in milliseconds — so the watchdog, which only asks the health path, never fired and nothing
 * restarted the gateway. The pages went through the pooled agent; its sibling API calls reused
 * connections that were already open.
 *
 * So the probe sends one request to the frontend through the SAME pooled agent the proxy uses, and when
 * that gets no answer it sends a second on a fresh connection. Only "pooled path silent, fresh path
 * answers" is the gateway's fault; a frontend that is itself slow or down fails both and is not reason to
 * end the gateway. A refused connection (a frontend still warming up during a deploy) is not silence.
 */
export class GatewayUpstreamProbe {
  static readonly TIMEOUT_MS = 5_000;
  private static readonly ANSWERED = 'answered';
  private static readonly TIMEOUT = 'timeout';
  private static readonly FAILED = 'failed';

  constructor(
    /** FRONTEND_TARGET_URL; empty in a deployment with no frontend behind the gateway. */
    private readonly target: string,
    /** The proxy's own agent: its pool and its address lookup are what this probe exercises. */
    private readonly agent: http.Agent,
    private readonly timeoutMs: number = GatewayUpstreamProbe.TIMEOUT_MS,
  ) {}

  /** What is wrong with the gateway's path to the frontend, or null when it works or cannot be judged. */
  async stalled(): Promise<string | null> {
    if (!this.target) return null;
    if (await GatewayUpstreamProbe.reach(this.target, this.agent, this.timeoutMs) !== GatewayUpstreamProbe.TIMEOUT) return null;
    // A full pool is never a reason to end the gateway: visitors (or an attacker) can fill it with slow
    // requests on purpose, and a restart would hand them the outage. Only a wait with free capacity counts.
    if (this.saturated()) return null;
    if (await GatewayUpstreamProbe.reach(this.target, false, this.timeoutMs) !== GatewayUpstreamProbe.ANSWERED) return null;
    return `its pooled requests to the frontend get no answer in ${this.timeoutMs} ms while a new connection is answered`;
  }

  /** True when some origin holds as many sockets as the pool allows, so a new request must queue. */
  private saturated(): boolean {
    return Object.values(this.agent.sockets).some((sockets) => (sockets ?? []).length >= this.agent.maxSockets);
  }

  /** Any HTTP answer counts, whatever its status; the clock covers the wait for a pooled socket too. */
  private static reach(target: string, agent: http.Agent | false, timeoutMs: number): Promise<string> {
    return new Promise((resolve) => {
      let request: http.ClientRequest;
      const timer = setTimeout(() => { request?.destroy(); resolve(GatewayUpstreamProbe.TIMEOUT); }, timeoutMs);
      const done = (outcome: string): void => { clearTimeout(timer); resolve(outcome); };
      try {
        request = http.get(new URL('/', target), { agent }, (res) => { res.resume(); done(GatewayUpstreamProbe.ANSWERED); });
      } catch {
        done(GatewayUpstreamProbe.FAILED);
        return;
      }
      request.on('error', () => done(GatewayUpstreamProbe.FAILED));
    });
  }
}

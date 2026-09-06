import { AsyncLocalStorage } from 'async_hooks';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import type { IPluginRemoteCall } from '@core/plugin/host/interfaces/plugin-remote-call.interface';

/**
 * The guest's view of anything that lives on the host: a chain of property reads and calls that is
 * sent as ONE message when it is awaited.
 *
 * `context.plugins.namespace('org.x').mlm.record(p)` reads like the in-process API and becomes four
 * steps. Nothing is sent until the chain is awaited (`then`), so a chain can be built, passed around
 * and awaited once. The current invocation token travels with every call — from the guest's own
 * AsyncLocalStorage, filled by the runtime when the host hands it work.
 */
export class PluginGuestRemote {
  /** Which invocation the current async flow belongs to; set by the guest runtime around each invocation. */
  static readonly invocation = new AsyncLocalStorage<{ token: string; tenantId: string | null }>();

  constructor(
    private readonly channel: PluginChannel,
    private readonly timeoutMs: number,
    /** Keeps a function under a stable id and returns the id; without one, functions are dropped (and named). */
    private readonly keep: ((handler: (...args: any[]) => unknown) => string) | null = null,
  ) {}

  /** A chainable proxy rooted at `root` (`context`, `core` or `ddl`). */
  ref(root: IPluginRemoteCall['root'], steps: IPluginRemoteCall['steps'] = []): any {
    return this.proxy(root, steps, PluginGuestRemote.currentToken());
  }

  /**
   * Sends one call and returns its result. The token is the one captured when the chain was built —
   * inside the handler the host invoked — so a chain awaited later still belongs to its invocation.
   */
  call(root: IPluginRemoteCall['root'], steps: IPluginRemoteCall['steps'], token: string | null = PluginGuestRemote.currentToken()): Promise<unknown> {
    return this.channel.request('call', { root, steps, token: token ?? PluginGuestRemote.currentToken() } satisfies IPluginRemoteCall, this.timeoutMs);
  }

  static currentToken(): string | null {
    return PluginGuestRemote.invocation.getStore()?.token ?? null;
  }

  /**
   * The token a call is made under: the CURRENT invocation's, when there is one. A handle a plugin
   * built once and kept — `const finance = context.plugins.optional('…:finance')` at `onInit`, used
   * on every request after — would otherwise carry its birth token (long revoked) into every later
   * call and be refused as `unknown_invocation`. The captured token is only for work that runs with
   * no invocation of its own (a timer the plugin set inside one).
   */
  private static tokenFor(captured: string | null): string | null {
    return PluginGuestRemote.currentToken() ?? captured;
  }

  private proxy(root: IPluginRemoteCall['root'], steps: IPluginRemoteCall['steps'], token: string | null): any {
    const remote = this;
    // A function target, so the proxy is callable; its name is never read.
    const target = function remoteRef(): void { /* proxied */ };
    return new Proxy(target, {
      get(_target, prop) {
        if (prop === 'then') {
          const promise = remote.call(root, steps, PluginGuestRemote.tokenFor(token));
          return promise.then.bind(promise);
        }
        if (prop === 'catch' || prop === 'finally') {
          const promise = remote.call(root, steps, PluginGuestRemote.tokenFor(token));
          return (promise as any)[prop].bind(promise);
        }
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'toJSON') return () => ({ $remote: root, steps });
        return remote.proxy(root, [...steps, { name: String(prop) }], token ?? PluginGuestRemote.currentToken());
      },
      apply(_target, _thisArg, args) {
        const last = steps[steps.length - 1];
        if (!last) throw new Error('A remote root cannot be called directly.');
        const dropped: string[] = [];
        const called = [...steps.slice(0, -1), { name: last.name, args: PluginGuestRemote.portable(args, dropped, remote.keep) }];
        if (dropped.length) remote.warnDropped([...steps.slice(0, -1).map((s) => s.name), last.name].join('.'), dropped);
        const bound = PluginGuestRemote.tokenFor(token);
        // A call that returns a HANDLE (another plugin's API, an integration) stays a lazy chain to be
        // walked further. Every other call is sent NOW: in-process these were plain synchronous calls
        // (`context.collections.extend(...)`, `context.settings.register(...)`) that no plugin awaits,
        // and a message that waits to be awaited is a message that is never sent.
        if (PluginGuestRemote.returnsHandle(called)) return remote.proxy(root, called, bound);
        return remote.settled(remote.call(root, called, bound), root, called, bound);
      },
      has() { return true; },
    });
  }

  /** The in-flight promise of a sent call, still chainable in case the caller keeps walking. */
  private settled(promise: Promise<unknown>, root: IPluginRemoteCall['root'], steps: IPluginRemoteCall['steps'], token: string | null): any {
    const remote = this;
    // In-process these were synchronous calls whose exceptions surfaced where they were made. Here a
    // rejection nobody awaits would be an "unhandled rejection" with no plugin or call named — so the
    // call path is logged on the host, while an awaiting caller still sees the rejection itself.
    promise.catch((error) => remote.warnRejected(steps.map((s) => s.name).join('.'), error));
    const target = function sentCall(): void { /* proxied */ };
    return new Proxy(target, {
      get(_target, prop) {
        if (prop === 'then') return promise.then.bind(promise);
        if (prop === 'catch') return promise.catch.bind(promise);
        if (prop === 'finally') return promise.finally.bind(promise);
        if (typeof prop === 'symbol') return undefined;
        return remote.proxy(root, [...steps, { name: String(prop) }], token);
      },
    });
  }

  private static returnsHandle(steps: IPluginRemoteCall['steps']): boolean {
    const last = steps[steps.length - 1]?.name;
    const prev = steps[steps.length - 2]?.name;
    if (prev === 'plugins' && ['namespace', 'get', 'require', 'optional'].includes(String(last))) return true;
    if (prev === 'dependencies' && ['require', 'optional'].includes(String(last))) return true;
    if (prev === 'integrations' && last === 'get') return true;
    return false;
  }

  /**
   * Arguments must survive structured clone. A function cannot — so with a `keep`er it crosses as a
   * HANDLE, `{ $fcCallback: id }`, which the host turns into an async stand-in that calls back here
   * (`PluginHostCallbacks`). That is how a search provider's `search`, an integration provider's
   * `create` or a collection's `access.read` work from an isolated plugin. Without a keeper (tests,
   * diagnostics) a function is DROPPED and its path collected into `dropped`, so the caller can say
   * which call lost what.
   */
  static portable(args: unknown[], dropped: string[] = [], keep: ((handler: (...args: any[]) => unknown) => string) | null = null): unknown[] {
    return args.map((arg, index) => PluginGuestRemote.portableValue(arg, 0, `arg${index}`, dropped, keep));
  }

  /** One value (a handler's result) made portable the same way. */
  portableResult(value: unknown): unknown {
    return PluginGuestRemote.portable([value], [], this.keep)[0];
  }

  /** Own enumerable statics of a class — the repo models data shapes as classes (`static readonly slug = …`). */
  private static statics(value: (...args: unknown[]) => unknown): Record<string, unknown> | null {
    const keys = Object.getOwnPropertyNames(value).filter((key) => !['length', 'name', 'prototype', 'caller', 'arguments'].includes(key));
    if (keys.length === 0) return null;
    const out: Record<string, unknown> = {};
    for (const key of keys) out[key] = (value as unknown as Record<string, unknown>)[key];
    return out;
  }

  private static portableValue(value: unknown, depth: number, at: string, dropped: string[], keep: ((handler: (...args: any[]) => unknown) => string) | null): unknown {
    if (typeof value === 'function') {
      // A class carrying static fields IS data (a collection definition); a bare function is not.
      const statics = PluginGuestRemote.statics(value as (...args: unknown[]) => unknown);
      if (statics) return PluginGuestRemote.portableValue(statics, depth, at, dropped, keep);
      if (keep) return { $fcCallback: keep(value as (...args: any[]) => unknown) };
      dropped.push(at);
      return undefined;
    }
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
    if (depth > 8 || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((entry, index) => PluginGuestRemote.portableValue(entry, depth + 1, `${at}[${index}]`, dropped, keep));
    if (Buffer.isBuffer(value) || value instanceof Date || value instanceof Map || value instanceof Set) return value;
    // A reactor Enum crosses as its value; the host revives it where the contract expects one.
    if (typeof (value as any).value === 'string' && (value as any).constructor && (value as any).constructor !== Object && Object.keys(value as object).length <= 2) {
      return (value as any).value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (typeof entry === 'function' && !keep) { dropped.push(`${at}.${key}`); continue; }
      out[key] = PluginGuestRemote.portableValue(entry, depth + 1, `${at}.${key}`, dropped, keep);
    }
    return out;
  }

  private readonly warned = new Set<string>();

  private warnRejected(call: string, error: unknown): void {
    this.channel.notify('log', { level: 'warn', msg: `isolated plugin: ${call}(…) failed on the host: ${error instanceof Error ? error.message : String(error)}`, meta: [] });
  }

  /** Once per call path: the host's log names the plugin, the call and every function that did not cross. */
  private warnDropped(call: string, dropped: string[]): void {
    const key = `${call}:${dropped.join(',')}`;
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.channel.notify('log', {
      level: 'warn',
      msg: `isolated plugin: ${call}(…) carried function(s) the process boundary cannot cross; dropped: ${dropped.join(', ')}. That behaviour does not run for this plugin while isolated.`,
      meta: [],
    });
  }
}

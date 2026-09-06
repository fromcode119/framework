import { RequestContextUtils } from '@core/context/request-context';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';

/**
 * Functions that cross the process boundary as HANDLES.
 *
 * A guest that hands the framework — or a peer plugin — an object with functions in it (a search
 * provider's `search`, an integration provider's `create`, a collection's `access.read`) sends
 * `{ $fcCallback: id }` in their place and keeps the function under that id. This class turns each
 * marker back into a function on the host: an async one that invokes the guest under the CURRENT
 * request's tenant, with arguments reduced to data (an Express request becomes its user, params,
 * query and body). Every consumer of these contracts awaits its result, which is what makes the
 * async stand-in equivalent to the in-process function.
 *
 * Ids are stable across a guest restart — the guest numbers them in registration order and a
 * restart re-runs the same `onInit` — so a stand-in a peer captured before the restart keeps working.
 */
export class PluginHostCallbacks {
  static readonly MARKER = '$fcCallback';
  private static readonly MAX_DEPTH = 8;

  constructor(private readonly invoke: (handlerId: string, args: unknown[], store: IRequestStore | undefined) => Promise<unknown>) {}

  /** Replaces every callback marker in `value` (deeply) with a host-side function. */
  revive<T>(value: T): T {
    return this.reviveValue(value, 0) as T;
  }

  private reviveValue(value: unknown, depth: number): unknown {
    if (value === null || typeof value !== 'object' || depth > PluginHostCallbacks.MAX_DEPTH) return value;
    if (Buffer.isBuffer(value) || value instanceof Date || value instanceof Map || value instanceof Set) return value;
    const marker = (value as Record<string, unknown>)[PluginHostCallbacks.MARKER];
    if (typeof marker === 'string' && Object.keys(value as object).length === 1) return this.standIn(marker);
    if (Array.isArray(value)) return value.map((entry) => this.reviveValue(entry, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = this.reviveValue(entry, depth + 1);
    return out;
  }

  private standIn(id: string): (...args: unknown[]) => Promise<unknown> {
    const callbacks = this;
    return (...args: unknown[]) => callbacks.invoke(id, PluginHostCallbacks.portableArgs(args), RequestContextUtils.storage.getStore());
  }

  /** Arguments as data: functions vanish, a request is reduced to what a handler may read of it, cycles are cut. */
  static portableArgs(args: unknown[]): unknown[] {
    const seen = new WeakSet<object>();
    return args.map((arg) => PluginHostCallbacks.portableValue(arg, 0, seen));
  }

  private static portableValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (typeof value === 'function') return undefined;
    if (value === null || typeof value !== 'object') return value;
    if (Buffer.isBuffer(value) || value instanceof Date) return value;
    if (depth > PluginHostCallbacks.MAX_DEPTH || seen.has(value)) return undefined;
    seen.add(value);
    if (PluginHostCallbacks.isRequest(value)) return PluginHostCallbacks.requestView(value as Record<string, unknown>);
    if (Array.isArray(value)) return value.map((entry) => PluginHostCallbacks.portableValue(entry, depth + 1, seen));
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const portable = PluginHostCallbacks.portableValue(entry, depth + 1, seen);
      if (portable !== undefined) out[key] = portable;
    }
    return out;
  }

  /** An Express request: has a socket and a `get` header accessor. Nothing else in a payload looks like this. */
  private static isRequest(value: object): boolean {
    const candidate = value as { socket?: unknown; headers?: unknown; method?: unknown; get?: unknown };
    return typeof candidate.get === 'function' && typeof candidate.method === 'string' && !!candidate.headers && !!candidate.socket;
  }

  private static requestView(req: Record<string, unknown>): Record<string, unknown> {
    return {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      params: req.params ?? {},
      query: req.query ?? {},
      body: req.body,
      user: req.user ?? null,
      tenantId: req.tenantId ?? null,
      headers: req.headers,
    };
  }
}

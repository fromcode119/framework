import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';

/**
 * Makes a host value crossable to an isolated plugin WITHOUT losing what the plugin came for.
 *
 * The old fallback was `JSON.parse(JSON.stringify(value))`, and before that a structured clone: both
 * keep the data and drop every method. For a row that is right, but an INTEGRATION CLIENT is behaviour
 * — `context.integrations.get('shipping_provider')` handed the Econt courier client to the guest as a
 * lifeless copy, so the plugin's own "does this expose a request API?" check failed and every office
 * lookup, quote and waybill call died at the boundary.
 *
 * A structured clone does not fail on such a client either: its own properties are ordinary data and the
 * methods live on the prototype, so the loss is silent. That is why behaviour is looked for FIRST here,
 * and the clone check only decides whether a value with no methods can travel untouched.
 *
 * An object with methods crosses as `{ $fcHostObject: { methods, path, data } }`: its data as before,
 * plus the method names and the property PATH at which it sat inside the result. The guest turns each
 * name back into a call that re-walks the same chain on the host (`PluginGuestRemote.rehydrate`), so the
 * host stays the only place that owns the instance.
 */
export class PluginHostPortableView {
  /** How deep to walk before treating what is left as data; deeper than this is a payload, not an API. */
  private static readonly MAX_DEPTH = 6;

  /** Wire marker for an object whose methods the guest must be able to call back into. */
  static readonly MARKER = '$fcHostObject';

  /**
   * A value with nothing but data crosses as ITSELF — the common result (rows, settings, a count) is not
   * copied or rewritten. Only when something in the graph carries behaviour is the transforming walk run.
   */
  /**
   * @param owner the plugin this value is being sent TO; a stand-in belonging to that same plugin goes
   *              home as its id, anything else crosses as a method it can call on the host.
   */
  /**
   * A host object that cannot be described at all — a Proxy that answers names on demand. The guest gets
   * a forwarder rather than a copy, so what it calls is resolved HERE, where the object really lives.
   */
  static opaque(value: unknown): unknown {
    // The names it answers to, when it will say: the host-side facade for an isolated plugin reports its
    // public API through `ownKeys`. Passing them on keeps feature detection working in the guest — a
    // forwarder that claimed EVERY name would make `api.searchOffices || api.resolveOffices` always pick
    // the first, even for a plugin that only has the second.
    const names = value && typeof value === 'object'
      ? Reflect.ownKeys(value as object).filter((key): key is string => typeof key === 'string')
      : [];
    return { [PluginHostPortableView.MARKER]: { opaque: true, path: [] as string[], names } };
  }

  static of(value: unknown, owner: string): unknown {
    return PluginHostPortableView.carriesBehaviour(value, 0) ? PluginHostPortableView.walk(value, [], 0, owner) : value;
  }

  /**
   * Whether anything in this graph would lose meaning as plain data: an object with methods of its own
   * class, or a bare function (which a structured clone refuses outright).
   */
  private static carriesBehaviour(value: unknown, depth: number): boolean {
    if (typeof value === 'function') return true;
    if (value === null || typeof value !== 'object') return false;
    if (depth >= PluginHostPortableView.MAX_DEPTH) return false;
    if (PluginHostPortableView.isBuiltIn(value)) return false;
    if (Array.isArray(value)) return value.some((entry) => PluginHostPortableView.carriesBehaviour(entry, depth + 1));
    if (PluginHostPortableView.methodNames(value).length) return true;
    return Object.values(value as Record<string, unknown>).some((entry) => PluginHostPortableView.carriesBehaviour(entry, depth + 1));
  }

  private static walk(value: unknown, path: string[], depth: number, owner: string): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'function') return undefined;
    if (typeof value !== 'object') return value;
    // Built-ins the clone already carries faithfully — their prototype methods are not an API a plugin
    // calls across the boundary, and wrapping them would turn a Date into an object of stubs.
    if (PluginHostPortableView.isBuiltIn(value)) return value;
    if (depth >= PluginHostPortableView.MAX_DEPTH) {
      return PluginHostPortableView.carriesBehaviour(value, 0) ? undefined : value;
    }

    if (Array.isArray(value)) {
      return value.map((entry, index) => PluginHostPortableView.walk(entry, [...path, String(index)], depth + 1, owner));
    }

    const data: Record<string, unknown> = {};
    const returned: string[] = [];
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (typeof entry === 'function') {
        // The guest's OWN function, handed out earlier and now coming home: send its id back so the guest
        // restores the real local function. That keeps the call in one process, as it was before
        // isolation — arguments the wire cannot carry faithfully (a reactor Enum collapses to its value)
        // never have to cross at all.
        const standIn = entry as unknown as Record<string, unknown>;
        const callbackId = standIn[PluginHostCallbacks.ID];
        if (typeof callbackId === 'string' && standIn[PluginHostCallbacks.OWNER] === owner) {
          data[key] = { [PluginHostCallbacks.MARKER]: callbackId };
          returned.push(key);
        }
        continue;
      }
      data[key] = PluginHostPortableView.walk(entry, [...path, key], depth + 1, owner);
    }

    // Own function properties count as much as prototype ones: an integration client is often an object
    // literal whose `request`/`requestByKey` are arrow properties, not class methods.
    const methods = PluginHostPortableView.methodNames(value).filter((name) => !returned.includes(name));
    if (!methods.length) return data;
    return { [PluginHostPortableView.MARKER]: { methods, path, data } };
  }

  private static isBuiltIn(value: object): boolean {
    return value instanceof Date
      || value instanceof Map
      || value instanceof Set
      || value instanceof RegExp
      || value instanceof Error
      || value instanceof ArrayBuffer
      || ArrayBuffer.isView(value);
  }

  /**
   * Every callable this object answers to, its own and its class's — a client's methods live on the
   * prototype, so own-property names alone would find none of them. `Object.prototype` ends the walk so
   * `toString`/`valueOf` never become remote calls.
   */
  private static methodNames(value: object): string[] {
    const names = new Set<string>();
    // `then` would make the rehydrated object a thenable and hang the next `await` on it; `toJSON` would
    // hijack every JSON.stringify of it into a remote call. Neither is an API a plugin means to call.
    const reserved = new Set(['then', 'catch', 'finally', 'toJSON']);
    let current: object | null = value;
    while (current && current !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(current)) {
        if (name === 'constructor' || reserved.has(name)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(current, name);
        if (!descriptor || typeof descriptor.value !== 'function') continue;
        names.add(name);
      }
      current = Object.getPrototypeOf(current);
    }
    return [...names];
  }
}

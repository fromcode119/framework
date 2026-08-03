import { WatcherDescriptor } from './watcher-descriptor';

/**
 * Per-class registry for the decorators. Each decorator records its target key on the
 * class prototype; the base component reads the merged (inheritance-aware) lists at
 * construction time. Kept off the instance so decorated classes stay serialisable.
 */
export class ReactiveMetadata {
  private static readonly stateFields = new WeakMap<object, Set<string>>();
  private static readonly watchers = new WeakMap<object, WatcherDescriptor[]>();

  /** Record a `@state` reactive field declared on `proto`. */
  static addStateField(proto: object, key: string): void {
    const set = ReactiveMetadata.stateFields.get(proto) ?? new Set<string>();
    set.add(key);
    ReactiveMetadata.stateFields.set(proto, set);
  }

  /** Record a `@watch(...keys)` method declared on `proto`. */
  static addWatcher(proto: object, method: string, keys: string[]): void {
    const list = ReactiveMetadata.watchers.get(proto) ?? [];
    list.push({ method, keys });
    ReactiveMetadata.watchers.set(proto, list);
  }

  /** All reactive-state field names for `instance`, walking the prototype chain. */
  static collectStateFields(instance: object): string[] {
    const out = new Set<string>();
    for (const proto of ReactiveMetadata.protoChain(instance)) {
      const set = ReactiveMetadata.stateFields.get(proto);
      if (set) for (const key of set) out.add(key);
    }
    return [...out];
  }

  /** All watcher descriptors for `instance`, walking the prototype chain. */
  static collectWatchers(instance: object): WatcherDescriptor[] {
    const out: WatcherDescriptor[] = [];
    for (const proto of ReactiveMetadata.protoChain(instance)) {
      const list = ReactiveMetadata.watchers.get(proto);
      if (list) out.push(...list);
    }
    return out;
  }

  private static protoChain(instance: object): object[] {
    const chain: object[] = [];
    let proto = Object.getPrototypeOf(instance);
    while (proto && proto !== Object.prototype) {
      chain.push(proto);
      proto = Object.getPrototypeOf(proto);
    }
    return chain;
  }
}

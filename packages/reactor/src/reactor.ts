import { Component, createRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';
import { ReactiveMetadata } from './reactive-metadata';
import { WatcherDescriptor } from './watcher-descriptor';
import { Transition } from './transition';
import { Platform } from './platform';

/**
 * Class-based OOP base for React components — the `Reactor`. Extends `React.Component` and adds:
 *  - `@state` reactive fields (assign a field → re-render, no `setState`)
 *  - `@watch(...keys)` change callbacks dispatched automatically
 *  - `patch()`      — a typed partial `setState` helper
 *  - `ref()`        — a typed ref, no raw `React.createRef`
 *  - `subscribe()`  — external-store subscription with auto-cleanup (replaces `useSyncExternalStore`)
 *  - `transition()` — low-priority update (replaces `useTransition`/`startTransition`)
 *
 * It wraps `componentDidMount`/`componentDidUpdate`/`componentWillUnmount` at construction, so
 * subclasses keep writing their own lifecycle methods normally and never call `super`. React-only:
 * the sole place raw `React.*` is touched, so consuming code stays pure OOP.
 */
export abstract class Reactor<P = Record<string, unknown>, S = Record<string, unknown>>
  extends Component<P, S> {
  private static __uidSeq = 0;
  private static readonly __metaCache = new WeakMap<Function, { stateFields: string[]; watchers: WatcherDescriptor[] }>();
  private __mounted = false;
  private __unmountWrapped = false;
  private __uid?: string;
  private readonly __cleanups: Array<() => void> = [];
  // Reactor's OWN last-seen values for watched keys. The `@state` setter mutates `this.state` in place
  // (so `this.x++` reads back synchronously), which also mutates the object React later hands back as
  // `prevState` — making React's prevState useless for change detection. We snapshot watched keys here
  // instead, so `@watch` fires reliably on real mounts, not only on hand-called componentDidUpdate.
  private readonly __watchPrev: Record<string, unknown> = {};

  /**
   * `context` is FORWARDED, not dropped.
   *
   * With `static contextType`, React constructs the instance as `new Ctor(props, context)` and relies on
   * `React.Component`'s constructor to assign `this.context`. React also assigns it again after
   * construction — so a component that only reads context in `render`/lifecycle never notices. One that
   * reads it in its CONSTRUCTOR sees `undefined`, and that failure is silent: it surfaces later as a null
   * deref on whatever the context was supposed to provide. (Real case: the storefront's checkout built its
   * controller in the constructor, got the null plugin facade instead of the real one, and every "order"
   * click died on `Cannot read properties of null (reading 'createCheckoutFlowController')`.)
   *
   * A subclass with its own constructor must forward too — `constructor(props, context) { super(props, context) }`.
   */
  constructor(props: P, context?: unknown) {
    super(props);
    // React's own `Component(props, context)` does this assignment; React 19's TYPES dropped the second
    // parameter, so `super(props, context)` will not compile and the value has to be applied here.
    // `context` is declared on Component, and React re-assigns it after construction anyway — this only
    // makes it available DURING the constructor.
    if (context !== undefined) (this as { context: unknown }).context = context;
    if (!this.state) this.state = {} as S;
    this.wrapLifecycle(Reactor.metaFor(this));
  }

  /**
   * Per-class metadata (state fields + watchers), computed ONCE per class and cached. On first use it also
   * installs the `@state` accessors on the class PROTOTYPE (shared by all instances) — so construction cost
   * is O(1), not O(state-fields), per instance.
   */
  private static metaFor(instance: object): { stateFields: string[]; watchers: WatcherDescriptor[] } {
    const ctor = instance.constructor;
    let meta = Reactor.__metaCache.get(ctor);
    if (!meta) {
      const stateFields = ReactiveMetadata.collectStateFields(instance);
      Reactor.defineStateAccessors(ctor.prototype as object, stateFields);
      meta = { stateFields, watchers: ReactiveMetadata.collectWatchers(instance) };
      Reactor.__metaCache.set(ctor, meta);
    }
    return meta;
  }

  /** Define `@state` fields as accessors on the prototype, backed by React state, once per class. */
  private static defineStateAccessors(proto: object, keys: string[]): void {
    for (const key of keys) {
      Object.defineProperty(proto, key, {
        configurable: true,
        get(this: { state?: Record<string, unknown> }): unknown {
          return this.state ? this.state[key] : undefined;
        },
        set(this: { state?: Record<string, unknown>; __mounted?: boolean; setState: (s: object) => void }, value: unknown): void {
          // MOUNTED: go through setState ONLY. Mutating `this.state` first made the change invisible
          // to `PureReactor.shouldComponentUpdate`, which compares `this.state` with `nextState` —
          // the in-place write meant they already matched, so with unchanged props it returned false
          // and the component NEVER RE-RENDERED. `@state` was silently dead on every PureReactor
          // (a plain Reactor was fine only because it defines no shouldComponentUpdate).
          if (this.__mounted) {
            this.setState({ [key]: value });
            return;
          }
          // PRE-MOUNT: no setState available yet, so seed the initial state object directly. This is
          // what lets a field initialiser (`@state open = false`) route through the accessor.
          (this.state ??= {})[key] = value;
        },
      });
    }
  }

  /**
   * MVC: point at a separate markup file instead of writing `render()`. The `*.view.tsx` file holds
   * ONLY bare markup that uses `this` (no class, no function, no imports); `@fromcode119/nextor`'s
   * ViewPlugin compiles it to this template function. Set it and skip `render()` entirely:
   *
   *   // card.view.tsx  (markup only — <Box>{this.label}</Box>, tags resolved from the Registry)
   *   // card.tsx  (logic only, no markup, no render())
   *   import cardView from './card.view';
   *   export class Card extends Reactor {
   *     @prop  declare label: string;
   *     @state open = true;
   *     get tone() { return this.open ? 'open' : 'shut'; }
   *     protected readonly view = cardView;   // the compiled markup file — no render() needed
   *   }
   *
   * Overriding `render()` inline still works; a `render()` override wins.
   */
  protected view?: (this: this) => ReactNode;

  /** Default render — calls the `view` template bound to this instance; else the subclass overrides. */
  render(): ReactNode {
    if (this.view) return this.view.call(this);
    const name = (this.constructor as { name?: string }).name ?? 'Reactor';
    throw new Error(`${name}: define a render() method or set a \`view\`.`);
  }

  /** Typed partial setState — `this.patch({ open: true })`. */
  protected patch(partial: Partial<S>): void {
    this.setState(partial as Pick<S, keyof S>);
  }

  /** A ref, without touching `React.createRef` or writing angle-brackets — `readonly box = this.ref()`. */
  protected ref<T = HTMLElement>(): RefObject<T | null> {
    return createRef<T>();
  }

  /**
   * Render `node` through a DOM portal — replaces raw `react-dom` `createPortal` so dropdowns, menus,
   * modals and tooltips stay pure OOP. Defaults the host to `document.body`; returns `null` during SSR
   * (no `document`) or when the container is missing, so callers compose it directly in `render()`.
   *   render() { return <>{this.trigger()}{this.open ? this.portal(this.menu()) : null}</>; }
   */
  protected portal(node: ReactNode, container?: Element | DocumentFragment): ReactNode {
    const host = container ?? (Platform.isBrowser ? document.body : null);
    // `createPortal` is cast to a loose signature: both its `ReactNode` parameter and its `ReactPortal`
    // return type have a DISTINCT type identity from this package's `ReactNode` whenever the build tree
    // has duplicate `@types/react` copies (as the Docker workspace install does). The value is a valid
    // node at runtime; the cast keeps the compile version-agnostic.
    const makePortal = createPortal as unknown as (n: ReactNode, c: Element | DocumentFragment) => ReactNode;
    return host ? makePortal(node, host) : null;
  }

  /** A process-stable unique id for this instance (replaces `useId`). */
  protected uid(prefix = 'r'): string {
    return (this.__uid ??= `${prefix}-${(Reactor.__uidSeq += 1)}`);
  }

  /** Run a state update at low priority (interruptible). Replaces `useTransition`/`startTransition`. */
  protected transition(update: () => void): void {
    Transition.run(update);
  }

  /**
   * Register a cleanup to run automatically on unmount — kills the `private x?: () => void` field,
   * the `this.x?.()` optional call, and the null-checked `componentWillUnmount`. Pass a canceller
   * straight through:  `this.onUnmount(scheduleIdle(() => …));`
   */
  protected onUnmount(cleanup: () => void): void {
    if (!this.__unmountWrapped) {
      const self = this as unknown as Record<string, ((...args: unknown[]) => unknown) | undefined>;
      const original = self['componentWillUnmount']?.bind(this);
      self['componentWillUnmount'] = (): void => {
        for (const c of this.__cleanups) c();
        this.__cleanups.length = 0;
        original?.();
      };
      this.__unmountWrapped = true;
    }
    this.__cleanups.push(cleanup);
  }

  /**
   * `addEventListener` that is removed automatically on unmount — no stored handler field, no manual
   * `removeEventListener`. The handler is a `@bound` method (stable identity).
   *   this.listen(window, 'resize', this.syncViewportWidth, { passive: true });
   */
  protected listen(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.onUnmount(() => target.removeEventListener(type, handler, options));
  }

  /**
   * Subscribe to an external store; re-renders on change and cleans up on unmount. Call from
   * `componentDidMount`. Replaces `useSyncExternalStore`.
   *   componentDidMount() { this.subscribe((onChange) => store.subscribe(onChange)); }
   */
  protected subscribe(register: (onChange: () => void) => () => void): void {
    this.onUnmount(register(() => this.forceUpdate()));
  }

  /** Move own `@state` data properties (emitted by define-semantics class fields) into `this.state`, so the
   *  prototype accessor — and therefore `setState` — owns the value from here on. */
  private adoptOwnStateFields(keys: string[]): void {
    const self = this as unknown as Record<string, unknown>;
    const state = this.state as Record<string, unknown> | undefined;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(self, key)) continue;
      const value = self[key];
      delete self[key];
      // A field initializer is the DEFAULT; a constructor that assigned `this.state` is an explicit
      // override and must win. Under define semantics the initializer never reaches `this.state`, so a
      // key already present there can only have come from the constructor — writing the field value back
      // would silently revert it. (This cost the account shell its section: `/account/orders` constructed
      // with `section: 'orders'` and rendered the overview, because `@state section = ''` was re-adopted.)
      if (state && Object.prototype.hasOwnProperty.call(state, key)) continue;
      self[key] = value;
    }
  }

  /** Wrap only the lifecycle methods this class actually needs — `@state` needs didMount, watchers need
   *  didUpdate; willUnmount is wrapped lazily by `onUnmount`. A component with none pays nothing here. */
  private wrapLifecycle(meta: { stateFields: string[]; watchers: WatcherDescriptor[] }): void {
    const self = this as unknown as Record<string, ((...args: unknown[]) => unknown) | undefined>;

    if (meta.stateFields.length > 0) {
      // A `@state` field initializer must land in `this.state` via the prototype accessor. Under
      // `useDefineForClassFields: true` (TS's default at modern targets, and what Next/SWC applies when it
      // does not read the flag from tsconfig) the initializer is emitted as `Object.defineProperty` instead
      // of an assignment, creating an OWN data property that SHADOWS the accessor — reads bypass `this.state`
      // and writes never reach `setState`, so the component silently never re-renders. Field initializers run
      // after `super()`, so the constructor cannot see them; adopt them on the first render instead.
      const stateFields = meta.stateFields;
      const originalRender = self['render']?.bind(this);
      let adopted = false;
      self['render'] = (...args: unknown[]): unknown => {
        if (!adopted) {
          adopted = true;
          this.adoptOwnStateFields(stateFields);
        }
        return originalRender?.(...args);
      };
    }

    if (meta.stateFields.length > 0 || meta.watchers.length > 0) {
      const watchers = meta.watchers;
      const originalDidMount = self['componentDidMount']?.bind(this);
      self['componentDidMount'] = (): void => {
        this.__mounted = true;
        if (watchers.length > 0) this.seedWatchPrev(watchers);
        originalDidMount?.();
      };
    }

    if (meta.watchers.length > 0) {
      const watchers = meta.watchers;
      const stateKeys = new Set(meta.stateFields);
      const originalDidUpdate = self['componentDidUpdate']?.bind(this);
      self['componentDidUpdate'] = (prevProps: unknown, prevState: unknown, snapshot?: unknown): void => {
        this.dispatchWatchers(watchers, stateKeys, prevProps as P);
        originalDidUpdate?.(prevProps, prevState, snapshot);
      };
    }
  }

  /**
   * Resolve a watched key's (prev, curr) pair. For `@state` keys we CANNOT trust React's `prevState` —
   * the `@state` setter mutates `this.state` in place, so React hands back an already-mutated prevState —
   * so we read the previous value from our own `__watchPrev` snapshot. Props are never mutated, so React's
   * `prevProps` is authoritative for `@prop` keys (also what the manual-didUpdate unit tests rely on).
   */
  private watchedPair(key: string, isState: boolean, prevProps: P): { prev: unknown; curr: unknown } {
    if (isState) {
      return { prev: this.__watchPrev[key], curr: (this.state as Record<string, unknown>)?.[key] };
    }
    return { prev: (prevProps as Record<string, unknown>)?.[key], curr: (this.props as Record<string, unknown>)?.[key] };
  }

  /** Seed the state-watch snapshot at mount so the FIRST post-mount state change compares to a real baseline. */
  private seedWatchPrev(watchers: WatcherDescriptor[]): void {
    const state = this.state as Record<string, unknown>;
    for (const watcher of watchers) {
      for (const key of watcher.keys) if (state && key in state) this.__watchPrev[key] = state[key];
    }
  }

  private dispatchWatchers(watchers: WatcherDescriptor[], stateKeys: Set<string>, prevProps: P): void {
    const instance = this as unknown as Record<string, (next: unknown, previous: unknown) => void>;
    for (const watcher of watchers) {
      for (const key of watcher.keys) {
        const { prev, curr } = this.watchedPair(key, stateKeys.has(key), prevProps);
        if (prev !== curr) {
          instance[watcher.method](curr, prev);
          break; // one fire per watcher, matching the first changed key
        }
      }
    }
    // Refresh the state snapshot AFTER dispatch so re-entrant state changes compare against this baseline.
    const state = this.state as Record<string, unknown>;
    for (const watcher of watchers) {
      for (const key of watcher.keys) if (stateKeys.has(key) && state) this.__watchPrev[key] = state[key];
    }
  }
}

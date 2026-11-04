import { RuntimeConstants } from '@core/constants/runtime.constants';

/**
 * Single source of truth for the host→plugin/theme runtime handoff.
 *
 * Plugin and theme bundles are separate ESM graphs; their externalized bare imports
 * (`react`, `react-dom`, `lucide-react`, `@fromcode119/*`) resolve — via import-map `data:` URL
 * modules — to entries on ONE namespaced browser global: `window.__fromcodeRuntimeModules`
 * (`RuntimeConstants.GLOBALS.MODULES`). There is no `window.Fromcode`, `window.React`,
 * `window.ReactDOM`, or `window.Lucide` — every runtime module lives under this registry.
 *
 * Framework-internal helper: used by the bridge installer, the import-map generators, and the
 * server-side runtime-service. It is NOT a plugin-facing SDK export, so it never touches the
 * react-shim allowlist.
 */
export class RuntimeRegistryAccess {
  /** Canonical registry keys. Bundles import these bare specifiers; the map resolves each here. */
  static readonly KEYS = {
    REACT: 'react',
    REACT_DOM: 'react-dom',
    JSX_RUNTIME: 'react/jsx-runtime',
    LUCIDE: 'lucide-react',
    REACT_BRIDGE: '@fromcode119/react',
    SDK: '@fromcode119/sdk',
    SDK_REACT: '@fromcode119/sdk/react',
  } as const;

  /**
   * The automatic JSX runtime, built from whichever React the registry holds.
   * Theme bundles load with NO import map (their externals are rewritten straight to this registry),
   * so `react/jsx-runtime` must exist here as a real module object, not only in the import map.
   */
  static jsxRuntimeFor(react: any): { jsx: any; jsxs: any; jsxDEV: any; Fragment: any } {
    const withKey = (props: any, key?: any) => (key === undefined ? props : { ...(props || {}), key });
    // `jsx` passes children untouched: an array there IS dynamic (a `.map`), and its key warning is real.
    const jsx = (type: any, props: any, key?: any) => react.createElement(type, withKey(props, key));
    // `jsxs` means "this child array was written out statically". Handed to `createElement` as one
    // `children` ARRAY it reads as a dynamic list, and dev React asks every multi-child element for keys.
    // Spread as VARARGS it is static by construction — the same rule as `ImportMapInstaller`'s map.
    const staticChildren = (type: any, props: any, key?: any) => {
      const merged = withKey(props, key);
      if (!merged || !Array.isArray(merged.children)) return react.createElement(type, merged);
      const { children, ...rest } = merged;
      return react.createElement(type, rest, ...children);
    };
    const jsxDEV = (type: any, props: any, key?: any, isStaticChildren?: boolean) =>
      (isStaticChildren ? staticChildren(type, props, key) : jsx(type, props, key));
    return { jsx, jsxs: staticChildren, jsxDEV, Fragment: react.Fragment };
  }

  /** The window-global registry name (the ONLY runtime handoff surface). */
  static get globalName(): string {
    return RuntimeConstants.GLOBALS.MODULES;
  }

  /**
   * A JS source EXPRESSION string that reads one module from the registry, null-safe.
   * Baked into import-map `data:` URL modules and server-side bridge sources.
   * e.g. `accessorExpr('react')` -> `(window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules['react'])`
   */
  static accessorExpr(key: string): string {
    const g = `window.${RuntimeRegistryAccess.globalName}`;
    return `(${g} && ${g}[${JSON.stringify(key)}])`;
  }

  /**
   * The live registry (browser runtime) — a READ-ONLY view for everyone outside the framework.
   *
   * The window binding is non-writable and non-configurable, so no script or console can swap the
   * registry for its own. Writes through the returned object are refused: a page script cannot
   * replace `react` or the bridge that every plugin and theme reads. The framework writes only
   * through `register`, which goes to the private store behind the view.
   */
  static ensure(): Record<string, any> {
    return RuntimeRegistryAccess.install().view;
  }

  /** Framework-only writer. Entries become visible through the read-only view immediately. */
  static register(key: string, value: unknown): void {
    RuntimeRegistryAccess.install().store[key] = value;
  }

  private static installed: { view: Record<string, any>; store: Record<string, any> } | null = null;

  private static install(): { view: Record<string, any>; store: Record<string, any> } {
    if (RuntimeRegistryAccess.installed) return RuntimeRegistryAccess.installed;
    const w = window as unknown as Record<string, any>;
    const name = RuntimeRegistryAccess.globalName;
    const existing = Object.getOwnPropertyDescriptor(w, name);
    // Another framework bundle on this page already installed it: share its store.
    const shared = existing?.value?.[RuntimeRegistryAccess.STORE];
    if (shared) {
      RuntimeRegistryAccess.installed = { view: existing!.value, store: shared };
      return RuntimeRegistryAccess.installed;
    }
    if (existing) {
      // Installed by a bundle that will not share its store any more: read, never write.
      console.warn('[fromcode] Runtime module registry is already sealed; this bundle reads it only.');
      RuntimeRegistryAccess.installed = { view: existing.value, store: {} };
      return RuntimeRegistryAccess.installed;
    }
    const store: Record<string, any> = {};
    const view = new Proxy(store, {
      get: (target, key) => (key === RuntimeRegistryAccess.STORE ? RuntimeRegistryAccess.storeOnce(target) : (target as any)[key]),
      set: (_target, key) => RuntimeRegistryAccess.refuse(key),
      defineProperty: (_target, key) => RuntimeRegistryAccess.refuse(key),
      deleteProperty: (_target, key) => RuntimeRegistryAccess.refuse(key),
      setPrototypeOf: () => false,
    });
    Object.defineProperty(w, name, { value: view, writable: false, configurable: false, enumerable: false });
    RuntimeRegistryAccess.installed = { view, store };
    return RuntimeRegistryAccess.installed;
  }

  /**
   * Handshake between framework bundles that each carry their own copy of core (admin + storefront
   * runtime). The store is handed out until the page finished loading its framework code, then never.
   */
  private static readonly STORE = Symbol.for('fromcode.runtime-registry.store');

  private static storeOnce(store: Record<string, any>): Record<string, any> | undefined {
    return RuntimeRegistryAccess.handshakeOpen() ? store : undefined;
  }

  private static handshakeOpen(): boolean {
    return document.readyState !== 'complete';
  }

  private static refuse(key: string | symbol): boolean {
    console.warn(`[fromcode] Refused a write to the runtime module registry (${String(key)}).`);
    return true;
  }
}

import { RuntimeHostModule } from '@core/constants/runtime-host-module.constants';

/**
 * Single source of truth for the host→plugin/theme runtime handoff.
 *
 * Plugin and theme bundles are separate ESM graphs; their externalized bare imports
 * (`react`, `react-dom`, `lucide-react`, `@fromcode119/*`) resolve — via import-map `data:` URL
 * modules — to entries in the runtime HOST MODULE (`RuntimeHostModule`). Nothing lives on `window`:
 * the framework writes through `register`, and reads through `get`; extensions read through imports.
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

  /** The automatic JSX runtime, built from whichever React the registry holds. */
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

  /**
   * A JS source EXPRESSION string that reads one module through the runtime host module.
   * Baked into import-map `data:` URL modules and server-side bridge sources, which must start with
   * `RuntimeHostModule.IMPORT` (`moduleSource` adds it).
   * e.g. `accessorExpr('react')` -> `__fcHostGet("react")`
   */
  static accessorExpr(key: string): string {
    return RuntimeHostModule.expr(key);
  }

  /** A generated module's source, with the host import its accessor expressions need. */
  static moduleSource(body: string): string {
    return RuntimeHostModule.withImport(body);
  }

  /**
   * Claims the runtime host module's writer and copies every entry registered so far into it.
   * Called once while the framework boots, BEFORE the import map is published: the generated modules
   * read the host at evaluation, so the host must hold every entry before any extension bundle loads.
   * A second framework bundle that claims while the document is still loading shares the same store;
   * one that arrives later finds the writer taken and reads the host only.
   */
  static connect(): Promise<void> {
    if (RuntimeRegistryAccess.connecting) return RuntimeRegistryAccess.connecting;
    // A variable, not a literal: bundlers leave the import to the browser instead of resolving it.
    const url = RuntimeHostModule.URL;
    RuntimeRegistryAccess.connecting = import(/* webpackIgnore: true */ /* @vite-ignore */ url).then((host) => {
      RuntimeRegistryAccess.hostGet = host.get as (key: string) => unknown;
      const writer = host.claim() as ((key: string, value: unknown) => void) | null;
      if (!writer) {
        console.warn('[fromcode] The runtime host module is already claimed; this bundle reads it only.');
        return;
      }
      RuntimeRegistryAccess.hostWriter = writer;
      const store = RuntimeRegistryAccess.store;
      Object.keys(store).forEach((key) => writer(key, store[key]));
    });
    return RuntimeRegistryAccess.connecting;
  }

  private static connecting: Promise<void> | null = null;
  private static hostWriter: ((key: string, value: unknown) => void) | null = null;
  private static hostGet: ((key: string) => unknown) | null = null;

  /** This bundle's own entries, private to the framework. Mirrored into the host once connected. */
  private static readonly store: Record<string, any> = {};

  /**
   * Framework-side read of one entry: this bundle's own registration, else the shared host (which holds
   * what another framework bundle on the page registered).
   */
  static get(key: string): any {
    return RuntimeRegistryAccess.store[key] ?? RuntimeRegistryAccess.hostGet?.(key);
  }

  /** Framework-only writer. The entry reaches the host immediately once connected. */
  static register(key: string, value: unknown): void {
    RuntimeRegistryAccess.store[key] = value;
    RuntimeRegistryAccess.hostWriter?.(key, value);
  }
}

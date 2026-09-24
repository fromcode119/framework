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

  /** Ensure and return the live registry object (browser runtime). */
  static ensure(): Record<string, any> {
    const w = window as unknown as Record<string, any>;
    return (w[RuntimeRegistryAccess.globalName] ||= {});
  }
}

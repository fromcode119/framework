import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';
import type { IImportMapSources } from '@react/helpers/interfaces/import-map-sources.interface';
import { RuntimeConstants, RuntimeImportMapReadiness, RuntimeRegistryAccess } from '@fromcode119/core/client';
import { LucideIconAssetUrl } from '@react/icons/lucide-icon-asset-url';

export class ImportMapInstaller {
  private static readonly RESERVED_IMPORT_NAMES = RuntimeConstants.CLIENT_HANDLED_MODULES;

  static install(
    args: IRuntimeBridgeInstallArgs,
    sources: IImportMapSources,
  ): void {
    const imports = ImportMapInstaller.buildStaticImports(args, sources);
    ImportMapInstaller.applyServerModules(imports, args);
    ImportMapInstaller.applyClientModules(imports, args);
    ImportMapInstaller.applySubpathAliases(imports);
    // The map goes into the document BEFORE the host import below. That import is a module load, and
    // Firefox ignores an import map inserted after any module load has started ("Import maps are not
    // allowed after a module load or preload has started"): every theme and plugin bundle then fails
    // on its first bare import and the storefront never hydrates. Chromium tolerates the late map, so
    // only Firefox broke. The map's modules read the runtime host when they EVALUATE, not when the map
    // is parsed, so the map is marked ready only once the host holds every registered entry. A host
    // that cannot load is reported and the map is still marked ready: extensions then fail loudly at
    // their import instead of the page waiting forever.
    const script = ImportMapInstaller.write(imports);
    void RuntimeRegistryAccess.connect()
      .catch((error) => console.error('[fromcode] The runtime host module could not be loaded.', error))
      .then(() => RuntimeImportMapReadiness.markReady(script));
  }

  /**
   * Subpaths a bundle may import that resolve to a module already in the map: `react-dom/client` is the
   * same registry entry as `react-dom` (it carries the root factories), and the theme style-variant
   * control is imported from its own subpath so the theme stays loadable on the server.
   */
  private static applySubpathAliases(imports: Record<string, string>): void {
    imports['react-dom/client'] = imports['react-dom'];
    imports['@fromcode119/sdk/admin/theme-style-variant-select'] = imports['@fromcode119/sdk/admin'];
  }

  private static write(imports: Record<string, string>): HTMLScriptElement {
    const existing = document.getElementById(RuntimeImportMapReadiness.SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing || document.createElement('script');
    if (!existing) {
      script.id = RuntimeImportMapReadiness.SCRIPT_ID;
      script.type = 'importmap';
      // An inline import map is inline SCRIPT to a Content-Security-Policy, which `'strict-dynamic'`
      // does not cover: it runs only with the page's nonce, taken from a script the page already trusts.
      const trusted = document.querySelector<HTMLScriptElement>('script[nonce]');
      if (trusted?.nonce) script.nonce = trusted.nonce;
    }
    // The text goes in before the element is inserted: a browser reads an import map once, on insertion.
    script.textContent = JSON.stringify({ imports });
    if (!existing) document.head.appendChild(script);
    return script;
  }

  /**
   * A generated module as a `data:` url. Every one starts with the runtime host import, because its
   * accessor expressions read the host module, not a window global.
   */
  private static moduleUrl(body: string): string {
    return 'data:application/javascript,' + encodeURIComponent(RuntimeRegistryAccess.moduleSource(body));
  }

  private static buildStaticImports(
    args: IRuntimeBridgeInstallArgs,
    sources: IImportMapSources,
  ): Record<string, string> {
    const reactExpr = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT);
    const reactDomExpr = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT_DOM);
    return {
      react:
        ImportMapInstaller.moduleUrl(`const __fcReact = ${reactExpr}; export default __fcReact; export const { useState, useEffect, useMemo, useCallback, useRef, createRef, createContext, useContext, useReducer, useLayoutEffect, useInsertionEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, useSyncExternalStore, Children, Fragment, StrictMode, Profiler, Component, PureComponent } = __fcReact;`),
      'react-dom':
        ImportMapInstaller.moduleUrl(`const __fcReactDom = ${reactDomExpr}; export default __fcReactDom; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot, hydrateRoot } = __fcReactDom;`),
      // `jsx` and `jsxs` are NOT the same function, and mapping both onto `createElement(type, props)`
      // is what produced "Each child in a list should have a unique key prop" all over the admin for
      // markup that has no list in it. `jsxs` is the automatic runtime's way of saying "this child
      // array was written out statically" — React trusts it and asks for no keys. Passed through
      // `createElement` as a single `children` ARRAY instead, that promise is lost and every
      // statically-written multi-child element looks like a dynamic list. Spreading the children as
      // VARARGS restores it: `createElement(type, props, a, b, c)` is static by construction.
      //
      // `jsx` keeps passing children untouched, deliberately: there the array IS dynamic (a `.map`),
      // and the warning it raises is a real missing key that must not be silenced.
      'react/jsx-runtime':
        ImportMapInstaller.moduleUrl(`const __fcR = ${reactExpr}; const __fcProps = (props, key) => key === undefined ? props : { ...(props || {}), key }; const __fcJsx = (type, props, key) => __fcR.createElement(type, __fcProps(props, key)); const __fcJsxs = (type, props, key) => { const p = __fcProps(props, key); if (!p || !Array.isArray(p.children)) return __fcR.createElement(type, p); const { children, ...rest } = p; return __fcR.createElement(type, rest, ...children); }; export const jsx = __fcJsx; export const jsxs = __fcJsxs; export const Fragment = __fcR.Fragment; export default { jsx, jsxs, Fragment };`),
      // The dev runtime carries the same distinction in its FOURTH argument (`isStaticChildren`).
      'react/jsx-dev-runtime':
        ImportMapInstaller.moduleUrl(`const __fcR = ${reactExpr}; const __fcJsxDEV = (type, props, key, isStaticChildren) => { const p = key === undefined ? props : { ...(props || {}), key }; if (!isStaticChildren || !p || !Array.isArray(p.children)) return __fcR.createElement(type, p); const { children, ...rest } = p; return __fcR.createElement(type, rest, ...children); }; export const jsxDEV = __fcJsxDEV; export const Fragment = __fcR.Fragment; export default { jsxDEV, Fragment };`),
      // A static module written beside the icons at build time (see `LucideIconNodeEmitter.namespaceModule`),
      // not a `data:` URL generated here: enumerating 5,730 icon names and URL-encoding them on every
      // page load was most of the runtime's longest boot task, and 400 KB of this import map.
      'lucide-react': LucideIconAssetUrl.namespaceUrl(),
      '@fromcode119/react': ImportMapInstaller.moduleUrl(sources.reactExportSource),
      '@fromcode119/admin/components': ImportMapInstaller.moduleUrl(sources.adminExportSource),
      '@fromcode119/admin': ImportMapInstaller.moduleUrl(sources.adminExportSource),
      '@fromcode119/sdk': ImportMapInstaller.moduleUrl(sources.sdkExportSource),
      '@fromcode119/sdk/react': ImportMapInstaller.moduleUrl(sources.sdkReactExportSource),
      '@fromcode119/sdk/admin': ImportMapInstaller.moduleUrl(sources.adminExportSource),
    };
  }

  private static applyServerModules(imports: Record<string, string>, args: IRuntimeBridgeInstallArgs): void {
    const currentServerModules = args.stabilityRef.current.serverRuntimeModules;
    if (!currentServerModules) return;
    const base = (args.stabilityRef.current as any).apiUrl || args.apiUrl || '';
    Object.entries(currentServerModules).forEach(([name, config]: [string, any]) => {
      if (ImportMapInstaller.RESERVED_IMPORT_NAMES.has(name)) {
        return;
      }
      if (config.url) {
        imports[name] = config.url.startsWith('/') ? `${base}${config.url}` : config.url;
      } else if (config.source) {
        imports[name] = `data:application/javascript;base64,${config.source}`;
      }
    });
  }

  private static applyClientModules(
    imports: Record<string, string>,
    args: IRuntimeBridgeInstallArgs,
  ): void {
    const currentClientModules = args.runtimeModules;
    if (!currentClientModules) return;
    let adminModuleSource: string | null = null;
    Object.entries(currentClientModules).forEach(([name, mod]) => {
      // Never allow runtime client modules to override reserved framework import names.
      if (ImportMapInstaller.RESERVED_IMPORT_NAMES.has(name)) {
        return;
      }
      RuntimeRegistryAccess.register(name, mod);
      const runtimeModuleAccessor = RuntimeRegistryAccess.accessorExpr(name);
      const keys =
        name === args.RuntimeConstants.MODULE_NAMES.ADMIN || name === args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS
          ? Array.from(
              new Set<string>([
                ...args.RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS,
                ...Object.keys(mod || {}),
              ]),
            )
          : Object.keys(mod || {});
      const source = ImportMapInstaller.moduleUrl(
        keys
          .map((key) => `export const ${key} = ${runtimeModuleAccessor} ? ${runtimeModuleAccessor}.${key} : undefined;`)
          .join('\n') + `\nexport default ${runtimeModuleAccessor};`,
      );
      imports[name] = source;
      if (name === args.RuntimeConstants.MODULE_NAMES.ADMIN || name === args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS) {
        adminModuleSource = source;
      }
    });
    if (adminModuleSource) {
      imports['@fromcode119/sdk/admin'] = adminModuleSource;
    }
  }
}

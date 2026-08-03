import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';
import type { IImportMapSources } from '@react/helpers/interfaces/import-map-sources.interface';
import { RuntimeConstants, RuntimeRegistryAccess } from '@fromcode119/core/client';

export class ImportMapInstaller {
  private static readonly RESERVED_IMPORT_NAMES = RuntimeConstants.CLIENT_HANDLED_MODULES;

  static install(
    args: IRuntimeBridgeInstallArgs,
    sources: IImportMapSources,
    runtimeRegistry: Record<string, any>,
  ): void {
    const imports = ImportMapInstaller.buildStaticImports(args, sources);
    ImportMapInstaller.applyServerModules(imports, args);
    ImportMapInstaller.applyClientModules(imports, args, runtimeRegistry);
    let script = document.getElementById('fc-runtime-import-map') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'fc-runtime-import-map';
      script.type = 'importmap';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({ imports });
    // Signal plugin-loaders that the import map is ready so they can start
    // loading theme/plugin bundles without waiting for the 50ms poll interval.
    window.dispatchEvent(new CustomEvent('fromcode:import-map-ready'));
  }

  private static buildStaticImports(
    args: IRuntimeBridgeInstallArgs,
    sources: IImportMapSources,
  ): Record<string, string> {
    const reactExpr = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT);
    const reactDomExpr = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT_DOM);
    const lucideExpr = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.LUCIDE);
    const lucideModule = RuntimeRegistryAccess.ensure()[RuntimeRegistryAccess.KEYS.LUCIDE] || {};
    return {
      react:
        `data:application/javascript,const __fcReact = ${reactExpr}; export default __fcReact; export const { useState, useEffect, useMemo, useCallback, useRef, createRef, createContext, useContext, useReducer, useLayoutEffect, useInsertionEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, useSyncExternalStore, Children, Fragment, StrictMode, Profiler, Component, PureComponent } = __fcReact;`,
      'react-dom':
        `data:application/javascript,const __fcReactDom = ${reactDomExpr}; export default __fcReactDom; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = __fcReactDom;`,
      'react/jsx-runtime':
        `data:application/javascript,const __fcR = ${reactExpr}; const __fcJsx = (type, props, key) => __fcR.createElement(type, key === undefined ? props : { ...(props || {}), key }); export const jsx = __fcJsx; export const jsxs = __fcJsx; export const Fragment = __fcR.Fragment; export default { jsx, jsxs, Fragment };`,
      'react/jsx-dev-runtime':
        `data:application/javascript,const __fcR = ${reactExpr}; const __fcJsxDEV = (type, props, key) => __fcR.createElement(type, key === undefined ? props : { ...(props || {}), key }); export const jsxDEV = __fcJsxDEV; export const Fragment = __fcR.Fragment; export default { jsxDEV, Fragment };`,
      'lucide-react':
        'data:application/javascript,' +
        encodeURIComponent(
          `const __fcLucide = ${lucideExpr};\n` +
          Object.keys(lucideModule)
            .filter((key) => key !== 'default' && key !== '__esModule' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key))
            .map((key) => `export const ${key} = __fcLucide.${key};`)
            .join('\n') + `\nexport default __fcLucide;`,
        ),
      '@fromcode119/react': 'data:application/javascript,' + encodeURIComponent(sources.reactExportSource),
      '@fromcode119/admin/components': 'data:application/javascript,' + encodeURIComponent(sources.adminExportSource),
      '@fromcode119/admin': 'data:application/javascript,' + encodeURIComponent(sources.adminExportSource),
      '@fromcode119/sdk': 'data:application/javascript,' + encodeURIComponent(sources.sdkExportSource),
      '@fromcode119/sdk/react': 'data:application/javascript,' + encodeURIComponent(sources.sdkReactExportSource),
      '@fromcode119/sdk/admin': 'data:application/javascript,' + encodeURIComponent(sources.adminExportSource),
    };
  }

  private static applyServerModules(imports: Record<string, string>, args: IRuntimeBridgeInstallArgs): void {
    const currentServerModules = args.stabilityRef.current.serverRuntimeModules;
    if (!currentServerModules) return;
    const base = (args.stabilityRef.current as any).apiUrl || (window as any).FROMCODE_API_URL || '';
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
    runtimeRegistry: Record<string, any>,
  ): void {
    const currentClientModules = args.runtimeModules;
    if (!currentClientModules) return;
    let adminModuleSource: string | null = null;
    Object.entries(currentClientModules).forEach(([name, mod]) => {
      // Never allow runtime client modules to override reserved framework import names.
      if (ImportMapInstaller.RESERVED_IMPORT_NAMES.has(name)) {
        return;
      }
      runtimeRegistry[name] = mod;
      const runtimeModuleAccessor = `(window.${args.RuntimeConstants.GLOBALS.MODULES} && window.${args.RuntimeConstants.GLOBALS.MODULES}[${JSON.stringify(name)}])`;
      const keys =
        name === args.RuntimeConstants.MODULE_NAMES.ADMIN || name === args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS
          ? Array.from(
              new Set<string>([
                ...args.RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS,
                ...Object.keys(mod || {}),
              ]),
            )
          : Object.keys(mod || {});
      const source =
        'data:application/javascript,' +
        encodeURIComponent(
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

import type { RuntimeBridgeInstallArgs } from '../context-runtime-bridge.interfaces';
import type { ImportMapSources } from './import-map-installer.interfaces';
import { RuntimeConstants } from '@fromcode119/core';

const RESERVED_IMPORT_NAMES = RuntimeConstants.CLIENT_HANDLED_MODULES;

export class ImportMapInstaller {
  static install(
    args: RuntimeBridgeInstallArgs,
    sources: ImportMapSources,
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
    args: RuntimeBridgeInstallArgs,
    sources: ImportMapSources,
  ): Record<string, string> {
    return {
      react:
        'data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext, useReducer, useLayoutEffect, useInsertionEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, useSyncExternalStore, Children, Fragment, StrictMode, Profiler, Component, PureComponent } = window.React;',
      'react-dom':
        'data:application/javascript,export default window.ReactDOM; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = window.ReactDOM;',
      'react/jsx-runtime':
        'data:application/javascript,const __fcJsx = (type, props, key) => window.React.createElement(type, key === undefined ? props : { ...(props || {}), key }); export const jsx = __fcJsx; export const jsxs = __fcJsx; export const Fragment = window.React.Fragment; export default { jsx, jsxs, Fragment };',
      'react/jsx-dev-runtime':
        'data:application/javascript,const __fcJsxDEV = (type, props, key) => window.React.createElement(type, key === undefined ? props : { ...(props || {}), key }); export const jsxDEV = __fcJsxDEV; export const Fragment = window.React.Fragment; export default { jsxDEV, Fragment };',
      'lucide-react':
        'data:application/javascript,' +
        encodeURIComponent(
          Object.keys((window as any).Lucide || (window as any).FrameworkIcons || {})
            .filter((key) => key !== 'default' && key !== '__esModule' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key))
            .map((key) => `export const ${key} = (window.Lucide || window.FrameworkIcons).${key};`)
            .join('\n') + `\nexport default (window.Lucide || window.FrameworkIcons);`,
        ),
      '@fromcode119/react': 'data:application/javascript,' + encodeURIComponent(sources.reactExportSource),
      '@fromcode119/admin/components': 'data:application/javascript,' + encodeURIComponent(sources.adminExportSource),
      '@fromcode119/admin': 'data:application/javascript,' + encodeURIComponent(sources.adminExportSource),
      '@fromcode119/sdk': 'data:application/javascript,' + encodeURIComponent(sources.sdkExportSource),
      '@fromcode119/sdk/react': 'data:application/javascript,' + encodeURIComponent(sources.sdkReactExportSource),
      '@fromcode119/sdk/admin': 'data:application/javascript,' + encodeURIComponent(sources.adminExportSource),
    };
  }

  private static applyServerModules(imports: Record<string, string>, args: RuntimeBridgeInstallArgs): void {
    const currentServerModules = args.stabilityRef.current.serverRuntimeModules;
    if (!currentServerModules) return;
    const base = (args.stabilityRef.current as any).apiUrl || (window as any).FROMCODE_API_URL || '';
    Object.entries(currentServerModules).forEach(([name, config]: [string, any]) => {
      if (RESERVED_IMPORT_NAMES.has(name)) {
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
    args: RuntimeBridgeInstallArgs,
    runtimeRegistry: Record<string, any>,
  ): void {
    const currentClientModules = args.runtimeModules;
    if (!currentClientModules) return;
    let adminModuleSource: string | null = null;
    Object.entries(currentClientModules).forEach(([name, mod]) => {
      // Never allow runtime client modules to override reserved framework import names.
      if (RESERVED_IMPORT_NAMES.has(name)) {
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

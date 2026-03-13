import type { RuntimeBridgeInstallArgs } from '../context-runtime-bridge.interfaces';
import type { ImportMapSources } from './import-map-installer.interfaces';

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
  }

  private static buildStaticImports(
    args: RuntimeBridgeInstallArgs,
    sources: ImportMapSources,
  ): Record<string, string> {
    return {
      react:
        'data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext, useReducer, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, Children, Fragment, StrictMode, Profiler, Component, PureComponent } = window.React;',
      'react-dom':
        'data:application/javascript,export default window.ReactDOM; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = window.ReactDOM;',
      'react/jsx-runtime':
        'data:application/javascript,export const jsx = window.React.createElement; export const jsxs = window.React.createElement; export const Fragment = window.React.Fragment; export default { jsx, jsxs, Fragment };',
      'react/jsx-dev-runtime':
        'data:application/javascript,export const jsxDEV = window.React.createElement; export const Fragment = window.React.Fragment; export default { jsxDEV, Fragment };',
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
    Object.entries(currentClientModules).forEach(([name, mod]) => {
      runtimeRegistry[name] = mod;
      const runtimeModuleAccessor = `window.${args.RuntimeConstants.GLOBALS.MODULES} && window.${args.RuntimeConstants.GLOBALS.MODULES}[${JSON.stringify(name)}]`;
      const keys =
        name === args.RuntimeConstants.MODULE_NAMES.ADMIN || name === args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS
          ? Array.from(
              new Set<string>([
                ...args.RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS,
                ...Object.keys(mod || {}),
              ]),
            )
          : Object.keys(mod || {});
      imports[name] =
        'data:application/javascript,' +
        encodeURIComponent(
          keys
            .map((key) => `export const ${key} = ${runtimeModuleAccessor} ? ${runtimeModuleAccessor}.${key} : undefined;`)
            .join('\n') + `\nexport default ${runtimeModuleAccessor};`,
        );
    });
  }
}

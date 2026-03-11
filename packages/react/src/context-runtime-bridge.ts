import type { GlobalStubSetupArgs, RuntimeBridgeInstallArgs } from './context-runtime-bridge.interfaces';

export class ContextRuntimeBridge {
  static setupGlobalStubs(args: GlobalStubSetupArgs): void {
    if (typeof window === 'undefined') return;

    if (!(window as any).Fromcode) {
      (window as any).Fromcode = {};
    }

    const fc = (window as any).Fromcode;
    fc.React = args.ReactRef;
    fc.ReactDOM = args.ReactDOMRef;
    fc.ReactDom = args.ReactDOMRef;

    (window as any).React = args.ReactRef;
    (window as any).ReactDOM = args.ReactDOMRef;
    (window as any).ReactDom = args.ReactDOMRef;
    (window as any).FrameworkIcons = args.FrameworkIcons;
    (window as any).FrameworkIconRegistry = args.FrameworkIconRegistry;

    const queueMethod = (type: string) => (...methodArgs: any[]) => {
      console.log(`[Fromcode] Queuing method: ${type}`, methodArgs);
      if (!(window as any)._fromcodeQueue) (window as any)._fromcodeQueue = [];
      (window as any)._fromcodeQueue.push({ type, args: methodArgs });
    };

    if (!fc.registerSlotComponent) fc.registerSlotComponent = queueMethod('slot');
    if (!fc.registerFieldComponent) fc.registerFieldComponent = queueMethod('field');
    if (!fc.registerOverride) fc.registerOverride = queueMethod('override');
    if (!fc.registerMenuItem) fc.registerMenuItem = queueMethod('menuItem');
    if (!fc.registerCollection) fc.registerCollection = queueMethod('collection');
    if (!fc.registerTheme) fc.registerTheme = queueMethod('theme');
    if (!fc.registerSettings) fc.registerSettings = queueMethod('settings');

    if (!fc.t) fc.t = (key: string, _params?: any, defaultValue?: string) => defaultValue || key;
    if (!fc.locale) fc.locale = 'en';

    fc.getIcon = args.getIcon;
    fc.FrameworkIcons = args.FrameworkIcons;
    (window as any).FrameworkIcons = args.FrameworkIcons;
    fc.FrameworkIconRegistry = args.FrameworkIconRegistry;
    fc.IconNames = args.IconNames;
    fc.createProxyIcon = args.createProxyIcon;
  }

  static installRuntimeBridge(args: RuntimeBridgeInstallArgs): void {
    if (typeof window === 'undefined') return;
    if (args.apiUrl) (window as any).FROMCODE_API_URL = args.apiUrl;

    const bridge = {
      React: args.ReactRef,
      ReactDOM: args.ReactDOMRef,
      ReactDom: args.ReactDOMRef,
      Slot: args.Slot,
      Override: args.Override,
      getIcon: args.getIcon,
      IconRegistry: args.FrameworkIconRegistry,
      FrameworkIconRegistry: args.FrameworkIconRegistry,
      FrameworkIcons: args.FrameworkIcons,
      IconNames: args.IconNames,
      createProxyIcon: args.createProxyIcon,
      RootFramework: args.RootFramework,
      Loader2: args.getIcon('Loader2'),
      Search: args.getIcon('Search'),
      Plus: args.getIcon('Plus'),
      Trash2: args.getIcon('Trash'),
      Pencil: args.getIcon('Edit'),
      Save: args.getIcon('Save'),
      Download: args.getIcon('Download'),
      Upload: args.getIcon('Upload'),
      RefreshCw: args.getIcon('Refresh'),
      ExternalLink: args.getIcon('External'),
      MoreHorizontal: args.getIcon('More'),
      Filter: args.getIcon('Filter'),
      FileText: args.getIcon('FileText'),
      Tag: args.getIcon('Tag'),
      Layers: args.getIcon('Layers'),
      ChevronDown: args.getIcon('Down'),
      ChevronRight: args.getIcon('Right'),
      Home: args.getIcon('Home'),
      Info: args.getIcon('Info'),
      AlertCircle: args.getIcon('Alert'),
      CheckCircle2: args.getIcon('Check'),
      MoreVertical: args.getIcon('MoreVertical'),
      Layout: args.getIcon('Layout'),
      Columns: args.getIcon('Columns'),
      Copy: args.getIcon('Copy'),
      Settings: args.getIcon('settings'),
      BarChart3: args.getIcon('BarChart3'),
      PlusCircle: args.getIcon('PlusCircle'),
      File: args.getIcon('File'),
      Film: args.getIcon('Film'),
      registerSlotComponent: args.registerSlotComponent,
      registerFieldComponent: args.registerFieldComponent,
      registerOverride: args.registerOverride,
      registerMenuItem: args.registerMenuItem,
      registerCollection: args.registerCollection,
      registerPlugins: args.registerPlugins,
      registerTheme: args.registerTheme,
      registerSettings: args.registerSettings,
      registerAPI: args.registerAPI,
      getAPI: args.getAPI,
      setPluginState: args.setPluginState,
      loadConfig: args.stableLoadConfig,
      getFrontendMetadata: args.stableGetFrontendMetadata,
      emit: args.emit,
      on: args.on,
      t: args.stableT,
      api: args.stableApiBridge,
      locale: () => args.stabilityRef.current.locale,
      setLocale: args.setLocale,
      usePlugins: args.usePlugins,
      useTranslation: args.useTranslation,
      usePluginAPI: args.usePluginAPI,
      usePluginState: args.usePluginState,
      useSystemShortcodes: args.useSystemShortcodes,
      CollectionQueryUtils: args.CollectionQueryUtils,
      queryCollectionDocs: args.CollectionQueryUtils.queryCollectionDocs,
      queryCollectionDocById: args.CollectionQueryUtils.queryCollectionDocById,
      queryCollectionDocByField: args.CollectionQueryUtils.queryCollectionDocByField,
      BrowserLocalization: args.BrowserLocalization,
      getPreferredBrowserLocale: args.BrowserLocalization.getPreferredBrowserLocale,
      normalizeLocaleCode: args.LocalizationUtils.normalizeLocaleCode,
      resolveLocalizedLabel: args.LocalizationUtils.resolveLabel,
      resolveRelationValue: args.RelationUtils.resolveRelationValue,
      resolveAnyString: args.LocalizationUtils.resolveAnyString,
      coerceNumber: args.CoercionUtils.toNumber,
      coerceBoolean: args.CoercionUtils.toBoolean,
      coerceObject: args.CoercionUtils.toObject,
      asString: args.CoercionUtils.toString,
      asNumber: args.CoercionUtils.toNumber,
      asBoolean: args.CoercionUtils.toBoolean,
      asObject: args.CoercionUtils.toObject,
      asArray: args.CoercionUtils.toArray,
      asDate: args.CoercionUtils.toIsoDateOrNow,
      toTrimmedString: args.CoercionUtils.toString,
      toFiniteNumber: args.CoercionUtils.toNumber,
      toBoolean: args.CoercionUtils.toBoolean,
      toIsoDateOrNow: args.CoercionUtils.toIsoDateOrNow,
      toIsoDateOrNull: args.CoercionUtils.toIsoDateOrNull,
      toSafeIsoDate: args.CoercionUtils.toSafeIsoDate,
      formatDate: args.FormatUtils.formatDate,
      formatMoney: args.FormatUtils.formatMoney,
      slugify: args.StringUtils.slugify,
      escapeHtml: args.StringUtils.escapeHtml,
      parseLimit: args.NumberUtils.parseLimit,
      parseCsv: args.StringUtils.parseCsv,
      round2: args.NumberUtils.round2,
      asNullableDate: args.CoercionUtils.toIsoDateOrNull,
      CoercionUtils: args.CoercionUtils,
      StringUtils: args.StringUtils,
      NumberUtils: args.NumberUtils,
      FormatUtils: args.FormatUtils,
      LocalizationUtils: args.LocalizationUtils,
      ApiVersionUtils: args.ApiVersionUtils,
      CollectionUtils: args.CollectionUtils,
      PaginationUtils: args.PaginationUtils,
      HookEventUtils: args.HookEventUtils,
      isReady: args.isReady,
      getState: () => args.stabilityRef.current,
      PluginsProvider: args.PluginsProvider,
    };

    const runtimeRegistry = ((window as any)[args.RuntimeConstants.GLOBALS.MODULES] ||= {});
    runtimeRegistry['@fromcode119/react'] = bridge;
    runtimeRegistry['@fromcode119/sdk'] = bridge;

    (window as any).Fromcode = bridge;
    (window as any).getIcon = args.getIcon;
    (window as any).FrameworkIcons = args.FrameworkIcons;
    (window as any).FrameworkIconRegistry = args.FrameworkIconRegistry;
    (window as any).React = args.ReactRef;
    (window as any).ReactDOM = args.ReactDOMRef;
    (window as any).ReactDom = args.ReactDOMRef;

    ContextRuntimeBridge.installImportMap(args, bridge, runtimeRegistry);
    ContextRuntimeBridge.flushQueue(args);
  }

  private static installImportMap(args: RuntimeBridgeInstallArgs, bridge: any, runtimeRegistry: Record<string, any>): void {
    const adminModule =
      runtimeRegistry[args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS] ||
      runtimeRegistry[args.RuntimeConstants.MODULE_NAMES.ADMIN] ||
      {};
    const adminExportKeys = Array.from(
      new Set<string>([
        ...args.RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS,
        ...Object.keys(adminModule),
      ]),
    ).filter((key) => {
      if (!key || key === 'default' || key === '__esModule') return false;
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return false;
      return true;
    });
    const adminModuleAccessor = `window.${args.RuntimeConstants.GLOBALS.MODULES} && (window.${args.RuntimeConstants.GLOBALS.MODULES}['${args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS}'] || window.${args.RuntimeConstants.GLOBALS.MODULES}['${args.RuntimeConstants.MODULE_NAMES.ADMIN}'])`;
    const adminExportSource =
      adminExportKeys
        .map((key) => `export const ${key} = ${adminModuleAccessor} ? ${adminModuleAccessor}.${key} : undefined;`)
        .join('\n') + `\nexport default ${adminModuleAccessor};`;

    const reactModuleAccessor = `window.${args.RuntimeConstants.GLOBALS.MODULES} && window.${args.RuntimeConstants.GLOBALS.MODULES}['@fromcode119/react']`;
    const reactExportSource =
      Object.keys(bridge)
        .filter((k) => typeof bridge[k] === 'function' || k === 'api' || (bridge[k] && bridge[k].$$typeof))
        .map((key) => `export const ${key} = ${reactModuleAccessor} ? ${reactModuleAccessor}.${key} : window.Fromcode.${key};`)
        .join('\n') + `\nexport default ${reactModuleAccessor} || window.Fromcode;`;

    const imports: Record<string, string> = {
      react:
        "data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext, useReducer, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, Children, Fragment, StrictMode, Profiler, Component, PureComponent } = window.React;",
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
            .map((key) => `export const ${key} = (window.Lucide || window.FrameworkIcons).${key};`)
            .join('\n') + `\nexport default (window.Lucide || window.FrameworkIcons);`,
        ),
      '@fromcode119/react': 'data:application/javascript,' + encodeURIComponent(reactExportSource),
      '@fromcode119/sdk': 'data:application/javascript,' + encodeURIComponent(reactExportSource),
      '@fromcode119/admin/components': 'data:application/javascript,' + encodeURIComponent(adminExportSource),
      '@fromcode119/admin': 'data:application/javascript,' + encodeURIComponent(adminExportSource),
    };

    const currentServerModules = args.stabilityRef.current.serverRuntimeModules;
    const currentClientModules = args.runtimeModules;

    if (currentServerModules) {
      const base = (args.stabilityRef.current as any).apiUrl || (window as any).FROMCODE_API_URL || '';
      Object.entries(currentServerModules).forEach(([name, config]: [string, any]) => {
        if (config.url) {
          imports[name] = config.url.startsWith('/') ? `${base}${config.url}` : config.url;
        } else if (config.source) {
          imports[name] = `data:application/javascript;base64,${config.source}`;
        }
      });
    }

    if (currentClientModules) {
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

    let script = document.getElementById('fc-runtime-import-map') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'fc-runtime-import-map';
      script.type = 'importmap';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({ imports });
  }

  private static flushQueue(args: RuntimeBridgeInstallArgs): void {
    if (!(window as any)._fromcodeQueue) return;

    console.log(`[Fromcode] Flushing queue with ${(window as any)._fromcodeQueue.length} items`);
    const queue = (window as any)._fromcodeQueue;
    delete (window as any)._fromcodeQueue;

    queue.forEach((item: any) => {
      try {
        console.log(`[Fromcode] Processing queued item: ${item.type}`, item.args);
        switch (item.type) {
          case 'slot':
            (args.registerSlotComponent as any)(...(item.args || [item.name, item.comp]));
            break;
          case 'field':
            (args.registerFieldComponent as any)(...(item.args || [item.name, item.component]));
            break;
          case 'override':
            (args.registerOverride as any)(...(item.args || [item.name, item.component]));
            break;
          case 'menuItem':
            (args.registerMenuItem as any)(...(item.args || [item.item]));
            break;
          case 'collection':
            (args.registerCollection as any)(...(item.args || [item.collection]));
            break;
          case 'theme':
            (args.registerTheme as any)(...(item.args || [item.slug, item.config]));
            break;
          case 'settings':
            (args.registerSettings as any)(...(item.args || [item.settings]));
            break;
        }
      } catch (error) {
        console.error(`[Fromcode] Failed to flush queued item of type ${item.type}:`, error);
      }
    });
  }
}
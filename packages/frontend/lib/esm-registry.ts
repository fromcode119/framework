import { RuntimeConstants, RuntimeBridge } from '@fromcode119/sdk';

/**
 * ESM Registry Utility
 * Generates the import map configuration for the framework runtime.
 */
export class EsmRegistry {
  static generateImportMap(): { imports: Record<string, string> } {
    const reactModuleAccessor = `window.${RuntimeConstants.GLOBALS.MODULES} && window.${RuntimeConstants.GLOBALS.MODULES}['@fromcode119/react']`;
    const adminModuleAccessor = `window.${RuntimeConstants.GLOBALS.MODULES} && (window.${RuntimeConstants.GLOBALS.MODULES}['${RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS}'] || window.${RuntimeConstants.GLOBALS.MODULES}['${RuntimeConstants.MODULE_NAMES.ADMIN}'])`;
    const bridge = `${reactModuleAccessor} || window.Fromcode || {}`;;

    // All SDK exports available via the React runtime bridge.
    // Plugin code uses class methods: CoercionUtils.toNumber(), StringUtils.slugify(), etc.
    const sdkExports = [
      // React integration
      'Slot', 'Override', 'usePlugins', 'useTranslation', 'usePluginAPI', 'PluginsProvider',
      'getIcon', 'createProxyIcon', 'FrameworkIcons', 'FrameworkIconRegistry', 'IconNames',
      'registerSlotComponent', 'registerFieldComponent', 'registerOverride', 'registerMenuItem',
      'registerCollection', 'registerPlugins', 'registerTheme', 'registerSettings',
      'registerAPI', 'getAPI', 'emit', 'on', 't', 'RuntimeBridge.getMetadata',
      // SDK constants
      'SystemConstants',
      // Non-deprecated direct exports
      'resolveRelationValue',
      // SDK utility classes (use class methods, not bare function aliases)
      ...RuntimeConstants.SDK_UTIL_CLASS_NAMES,
    ].join(', ');

    return {
      imports: {
        "react": "data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef, useReducer, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, Fragment, Profiler, StrictMode, Children, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, Component, PureComponent, version } = window.React;",
        "react-dom": "data:application/javascript,const rd = window.ReactDOM || window.ReactDom; export default rd; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = rd;",
        "@fromcode119/react": `data:application/javascript,export const { Slot, Override, usePlugins, useTranslation, usePluginAPI, PluginsProvider, getIcon, createProxyIcon, FrameworkIcons, FrameworkIconRegistry, IconNames, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, emit, on, CliUtils, RuntimeBridge } = ${bridge}; export default ${reactModuleAccessor} || window.Fromcode;`,
        "@fromcode119/sdk": `data:application/javascript,export const { ${sdkExports} } = ${bridge}; export default ${reactModuleAccessor} || window.Fromcode;`,
        "@fromcode119/admin": `data:application/javascript,export default ${adminModuleAccessor} || window.Fromcode;`,
        "@fromcode119/admin/components": `data:application/javascript,export default ${adminModuleAccessor} || window.Fromcode;`,
        "react/jsx-runtime": "data:application/javascript,export const jsx = window.React.createElement; export const jsxs = window.React.createElement; export const Fragment = window.React.Fragment; export default { jsx, jsxs, Fragment };",
        "lucide-react": "data:application/javascript,const L = window.Lucide || window.FrameworkIcons; export const { Zap, X, Menu, ArrowRight, Timer, CheckCircle2, ShieldCheck, VolumeX, Volume2, TrendingDown, Users, Clock, Gauge, Flame, ExternalLink, Star, MousePointer2, Check, Calculator, TrendingUp, Info, MessageSquare, Globe, ChevronUp, ArrowLeft, Hammer, Minus, MousePointerClick, Plus, Rocket, Target, Video } = L; export default L;",
      },
    };
  }
}
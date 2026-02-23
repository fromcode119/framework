import { RUNTIME_GLOBALS, RUNTIME_MODULE_NAMES } from '@fromcode119/sdk';

/**
 * ESM Registry Utility
 * Generates the import map configuration for the framework runtime.
 */

export const generateImportMap = () => {
  const reactModuleAccessor = `window.${RUNTIME_GLOBALS.MODULES} && window.${RUNTIME_GLOBALS.MODULES}['@fromcode119/react']`;
  const adminModuleAccessor = `window.${RUNTIME_GLOBALS.MODULES} && (window.${RUNTIME_GLOBALS.MODULES}['${RUNTIME_MODULE_NAMES.ADMIN_COMPONENTS}'] || window.${RUNTIME_GLOBALS.MODULES}['${RUNTIME_MODULE_NAMES.ADMIN}'])`;

  return {
    imports: {
      "react": "data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef, useReducer, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, Fragment, Profiler, StrictMode, Children, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, Component, PureComponent, version } = window.React;",
      "react-dom": "data:application/javascript,const rd = window.ReactDOM || window.ReactDom; export default rd; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = rd;",
      "@fromcode119/react": `data:application/javascript,export const { Slot, Override, usePlugins, useTranslation, usePluginAPI, PluginsProvider, getIcon, createProxyIcon, FrameworkIcons, FrameworkIconRegistry, IconNames, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, emit, on, t } = ${reactModuleAccessor} || window.Fromcode || {}; export default ${reactModuleAccessor} || window.Fromcode;`,
      "@fromcode119/sdk": `data:application/javascript,export const { Slot, Override, usePlugins, useTranslation, usePluginAPI, PluginsProvider, getIcon, createProxyIcon, FrameworkIcons, FrameworkIconRegistry, IconNames, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, emit, on, t } = ${reactModuleAccessor} || window.Fromcode || {}; export default ${reactModuleAccessor} || window.Fromcode;`, // SDK exports available via react bridge for compatibility
      "@fromcode119/admin": `data:application/javascript,export default ${adminModuleAccessor} || window.Fromcode;`,
      "@fromcode119/admin/components": `data:application/javascript,export default ${adminModuleAccessor} || window.Fromcode;`,
      "react/jsx-runtime": "data:application/javascript,export const jsx = window.React.createElement; export const jsxs = window.React.createElement; export const Fragment = window.React.Fragment; export default { jsx, jsxs, Fragment };",
      "lucide-react": "data:application/javascript,const L = window.Lucide || window.FrameworkIcons; export const { Zap, X, Menu, ArrowRight, Timer, CheckCircle2, ShieldCheck, VolumeX, Volume2, TrendingDown, Users, Clock, Gauge, Flame, ExternalLink, Star, MousePointer2, Check, Calculator, TrendingUp, Info, MessageSquare, Globe, ChevronUp, ArrowLeft, Hammer, Minus, MousePointerClick, Plus, Rocket, Target, Video } = L; export default L;"
    }
  };
};

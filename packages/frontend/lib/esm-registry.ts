
/**
 * ESM Registry Utility
 * Generates the import map configuration for the framework runtime.
 */

export const generateImportMap = () => {
  return {
    imports: {
      "react": "data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef, useReducer, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, Fragment, Profiler, StrictMode, Children, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, Component, PureComponent, version } = window.React;",
      "react-dom": "data:application/javascript,const rd = window.ReactDOM || window.ReactDom; export default rd; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = rd;",
      "@fromcode/react": "data:application/javascript,export const { Slot, Override, usePlugins, useTranslation, usePluginAPI, PluginsProvider, getIcon, createProxyIcon, FrameworkIcons, FrameworkIconRegistry, IconNames, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, emit, on, t } = window.Fromcode;",
      "react/jsx-runtime": "data:application/javascript,export const jsx = window.React.createElement; export const jsxs = window.React.createElement; export const Fragment = window.React.Fragment; export default { jsx, jsxs, Fragment };",
      "lucide-react": "data:application/javascript,const L = window.Lucide || window.FrameworkIcons; export const { Zap, X, Menu, ArrowRight, Timer, CheckCircle2, ShieldCheck, VolumeX, Volume2, TrendingDown, Users, Clock, Gauge, Flame, ExternalLink, Star, MousePointer2, Check, Calculator, TrendingUp, Info, MessageSquare, Globe, ChevronUp, ArrowLeft, Hammer, Minus, MousePointerClick, Plus, Rocket, Target, Video } = L; export default L;"
    }
  };
};

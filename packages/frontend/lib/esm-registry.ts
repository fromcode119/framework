
/**
 * ESM Registry Utility
 * Generates the import map configuration for the framework runtime.
 */

export const generateImportMap = () => {
  return {
    imports: {
      "react": "data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, version } = window.React;",
      "react-dom": "data:application/javascript,const rd = window.ReactDOM || window.ReactDom; export default rd; export const render = (...args) => rd.render(...args); export const hydrate = (...args) => rd.hydrate(...args); export const createPortal = (...args) => rd.createPortal(...args); export const createRoot = (...args) => rd.createRoot(...args);",
      "@fromcode/react": "data:application/javascript,export const { Slot, Override, usePlugins, useTranslation, usePluginAPI, PluginsProvider, getIcon, createProxyIcon, FrameworkIcons, FrameworkIconRegistry, IconNames, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, emit, on, t } = window.Fromcode;",
      "react/jsx-runtime": "data:application/javascript,export const jsx = window.React.createElement; export const jsxs = window.React.createElement; export const Fragment = window.React.Fragment;",
      "lucide-react": "data:application/javascript,export default new Proxy({}, { get: (_, name) => window.Fromcode.getIcon(name) });"
    }
  };
};

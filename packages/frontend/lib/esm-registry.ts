import { RuntimeConstants, RuntimeRegistryAccess } from '@fromcode119/core/client';

/**
 * ESM Registry Utility
 * Generates the import map configuration for the framework runtime.
 *
 * Every specifier resolves through the ONE namespaced runtime registry
 * (`window.__fromcodeRuntimeModules`) — there is no `window.Fromcode`/`window.React`/`window.ReactDOM`.
 */
export class EsmRegistry {
  static generateImportMap(): { imports: Record<string, string> } {
    const reactModuleAccessor = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT_BRIDGE);
    const reactAccessor = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT);
    const reactDomAccessor = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT_DOM);
    const lucideAccessor = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.LUCIDE);
    const adminModuleAccessor = `window.${RuntimeConstants.GLOBALS.MODULES} && (window.${RuntimeConstants.GLOBALS.MODULES}['${RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS}'] || window.${RuntimeConstants.GLOBALS.MODULES}['${RuntimeConstants.MODULE_NAMES.ADMIN}'])`;
    const bridge = `${reactModuleAccessor} || {}`;

    const sdkExportKeys = [
      'BaseRepository',
      'BaseService',
      'BaseController',
      'CoercionUtils',
      'StringUtils',
      'NumberUtils',
      'FormatUtils',
      'ApiRequestError',
      'ApiRequestService',
      'ApiQueryUtils',
      'ApiPathUtils',
      'AdminUserClient',
      'ApiScopeClient',
      'CollectionScopeClient',
      'SettingsScopeClient',
      'SdkClient',
      'AdminGlobalClient',
      'AdminResourceClient',
      'AdminSdkClient',
      'Plugins',
      'PluginsFacade',
      'NamespacedPluginsFacade',
      'PluginsRegistry',
      'RouteUtils',
      'UrlUtils',
      'PublicAssetUrlUtils',
      'ApiVersionUtils',
      'LocalizationUtils',
      'CollectionUtils',
      'HookEventUtils',
      'PaginationUtils',
      'RelationUtils',
      'ShortcodeUtils',
      'PluginDefinitionUtils',
      'RuntimeBridge',
      'CoreServices',
      'SystemConstants',
      'RuntimeConstants',
      'RouteConstants',
      'PublicRouteConstants',
      'DataSourceConstants',
      'Logger',
      'LogLevel',
      'CapabilityRegistry',
      'PluginFrontendLayoutRegistrar',
      'ThemeFrontendLayoutRegistrar',
      'RecordVersions',
      'PluginCapability',
      'MiddlewareStage',
      'InteractiveCanvas',
      'LiveBlocks',
      'LocalizedField',
      'PublicSettings',
      'SystemAuthSession',
      // Storefront blocks need light/dark. Without it here, a plugin frontend bundle importing
      // `ThemeMode` from `@fromcode119/sdk` fails to load and the page body renders empty — this list
      // is hand-maintained, so every new SDK export a frontend bundle uses must be added.
      'ThemeMode',
    ];
    const sdkExportSource =
      sdkExportKeys
        .map((key) => `export const ${key} = (${bridge}).${key};`)
        .join('\n') +
      `\nexport default ${reactModuleAccessor};`;
    const sdkReactExportSource =
      `export const { FrameworkIcons, FrameworkIconRegistry, PluginsProvider, ContextHooks, ContextBridge, PluginUiRegistrar, Slot, Override, ThemeOverrideRegistrar, RootFramework, SystemShortcodes, CollectionQueryUtils, BrowserLocalization, AsyncDataController, LazyComponentLoaderService, LazyLoadClass, PageStyleContext, PageStyleProvider, PageStyleHooks } = ${bridge};` +
      `\nexport default ${reactModuleAccessor};`;
    const sdkClientLayoutExportSource =
      `export const { PluginFrontendLayoutRegistrar, ThemeFrontendLayoutRegistrar } = ${bridge};` +
      `\nexport default ${bridge};`;

    return {
      imports: {
        "react": `data:application/javascript,const __fcReact = ${reactAccessor}; export default __fcReact; export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef, useReducer, useLayoutEffect, useInsertionEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, Fragment, Profiler, StrictMode, Children, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, useSyncExternalStore, Component, PureComponent, version } = __fcReact;`,
        "react-dom": `data:application/javascript,const rd = ${reactDomAccessor}; export default rd; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = rd;`,
        "@fromcode119/react": `data:application/javascript,export const { Slot, Override, ThemeOverrideRegistrar, usePlugins, useTranslation, usePluginAPI, PluginsProvider, ContextHooks, ContextBridge, PluginUiRegistrar, getIcon, createProxyIcon, FrameworkIcons, FrameworkIconRegistry, IconNames, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, registerPluginApi, getPluginApi, hasPluginApi, emit, on, CliUtils, RuntimeBridge, SystemShortcodes, CollectionQueryUtils, BrowserLocalization, AsyncDataController, LazyComponentLoaderService, LazyLoadClass, PageStyleContext, PageStyleProvider, PageStyleHooks } = ${bridge}; export default ${reactModuleAccessor};`,
        "@fromcode119/sdk": `data:application/javascript,${encodeURIComponent(sdkExportSource)}`,
        "@fromcode119/sdk/client/layout": `data:application/javascript,${encodeURIComponent(sdkClientLayoutExportSource)}`,
        "@fromcode119/sdk/react": `data:application/javascript,${encodeURIComponent(sdkReactExportSource)}`,
        "@fromcode119/admin": `data:application/javascript,export default ${adminModuleAccessor};`,
        "@fromcode119/admin/components": `data:application/javascript,export default ${adminModuleAccessor};`,
        "react/jsx-runtime": `data:application/javascript,const __fcR = ${reactAccessor}; const __fcJsx = (type, props, key) => __fcR.createElement(type, key === undefined ? props : { ...(props || {}), key }); export const jsx = __fcJsx; export const jsxs = __fcJsx; export const Fragment = __fcR.Fragment; export default { jsx, jsxs, Fragment };`,
        "lucide-react": `data:application/javascript,const L = ${lucideAccessor}; export const { Activity, AlertCircle, AlertTriangle, AlignLeft, ArrowDown, ArrowDownRight, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Banknote, BarChart, BarChart3, Bell, BookOpen, Boxes, Calculator, Calendar, Camera, Check, CheckCircle, CheckCircle2, CheckSquare, ChevronDown, ChevronRight, ChevronUp, CircleCheckBig, CircleDollarSign, CircleHelp, ClipboardList, Clock, Clock3, Columns, Compass, CreditCard, DollarSign, Download, Edit3, ExternalLink, Eye, FilePenLine, FileText, Film, Filter, Fingerprint, Flame, FolderOpen, Gauge, Gift, Github, Globe, GripVertical, Hammer, Hash, Image, Inbox, Info, Layers, Layout, LayoutDashboard, LayoutGrid, Link, Link2, Loader2, Lock, LogIn, LogOut, Mail, Map, MapPinned, Maximize, Menu, MessageSquare, MessageSquareQuote, Minus, Monitor, MousePointer2, MousePointerClick, Move, Navigation, Network, Package, PackageCheck, Palette, Pencil, Phone, Play, Plus, PlusSquare, Puzzle, Quote, Receipt, RefreshCw, Rocket, RotateCcw, Save, Scale, ScanSearch, Search, Settings, Settings2, Share, Share2, Shield, ShieldAlert, ShieldCheck, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Star, Tag, Target, Timer, Trash2, TrendingDown, TrendingUp, TriangleAlert, Trophy, Truck, Twitter, Type, Upload, User, UserX, Users, Video, Volume2, VolumeX, Wallet, Wand2, Wind, X, XCircle, Zap } = L; export default L;`,
      },
    };
  }
}

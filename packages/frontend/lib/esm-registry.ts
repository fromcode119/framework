import { RuntimeConstants } from '@fromcode119/core/client';

/**
 * ESM Registry Utility
 * Generates the import map configuration for the framework runtime.
 */
export class EsmRegistry {
  static generateImportMap(): { imports: Record<string, string> } {
    const reactModuleAccessor = `window.${RuntimeConstants.GLOBALS.MODULES} && window.${RuntimeConstants.GLOBALS.MODULES}['@fromcode119/react']`;
    const adminModuleAccessor = `window.${RuntimeConstants.GLOBALS.MODULES} && (window.${RuntimeConstants.GLOBALS.MODULES}['${RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS}'] || window.${RuntimeConstants.GLOBALS.MODULES}['${RuntimeConstants.MODULE_NAMES.ADMIN}'])`;
    const bridge = `${reactModuleAccessor} || window.Fromcode || {}`;;

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
      'EnvConfig',
      'CapabilityRegistry',
      'IntegrationRegistry',
      'RecordVersions',
      'PluginCapability',
      'MiddlewareStage',
    ];
    const sdkExportSource =
      sdkExportKeys
        .map((key) => `export const ${key} = ${bridge}.${key};`)
        .join('\n') +
      `\nexport default ${reactModuleAccessor} || window.Fromcode;`;

    return {
      imports: {
        "react": "data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef, useReducer, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, Fragment, Profiler, StrictMode, Children, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, Component, PureComponent, version } = window.React;",
        "react-dom": "data:application/javascript,const rd = window.ReactDOM || window.ReactDom; export default rd; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = rd;",
        "@fromcode119/react": `data:application/javascript,export const { Slot, Override, usePlugins, useTranslation, usePluginAPI, PluginsProvider, getIcon, createProxyIcon, FrameworkIcons, FrameworkIconRegistry, IconNames, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, registerPluginApi, getPluginApi, hasPluginApi, emit, on, CliUtils, RuntimeBridge } = ${bridge}; export default ${reactModuleAccessor} || window.Fromcode;`,
        "@fromcode119/sdk": `data:application/javascript,${encodeURIComponent(sdkExportSource)}`,
        "@fromcode119/admin": `data:application/javascript,export default ${adminModuleAccessor} || window.Fromcode;`,
        "@fromcode119/admin/components": `data:application/javascript,export default ${adminModuleAccessor} || window.Fromcode;`,
        "react/jsx-runtime": "data:application/javascript,const __fcJsx = (type, props, key) => window.React.createElement(type, key === undefined ? props : { ...(props || {}), key }); export const jsx = __fcJsx; export const jsxs = __fcJsx; export const Fragment = window.React.Fragment; export default { jsx, jsxs, Fragment };",
        "lucide-react": "data:application/javascript,const L = window.Lucide || window.FrameworkIcons; export const { Activity, AlertCircle, AlertTriangle, AlignLeft, ArrowDown, ArrowDownRight, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Banknote, BarChart, BarChart3, Bell, BookOpen, Boxes, Calculator, Calendar, Camera, Check, CheckCircle, CheckCircle2, CheckSquare, ChevronDown, ChevronRight, ChevronUp, CircleCheckBig, CircleDollarSign, CircleHelp, ClipboardList, Clock, Clock3, Columns, Compass, CreditCard, DollarSign, Download, Edit3, ExternalLink, Eye, FilePenLine, FileText, Film, Filter, Fingerprint, Flame, FolderOpen, Gauge, Gift, Github, Globe, GripVertical, Hammer, Hash, Image, Inbox, Info, Layers, Layout, LayoutDashboard, LayoutGrid, Link, Link2, Loader2, Lock, LogIn, LogOut, Mail, Map, MapPinned, Maximize, Menu, MessageSquare, MessageSquareQuote, Minus, Monitor, MousePointer2, MousePointerClick, Move, Navigation, Network, Package, PackageCheck, Palette, Pencil, Phone, Play, Plus, PlusSquare, Puzzle, Quote, Receipt, RefreshCw, Rocket, RotateCcw, Save, Scale, ScanSearch, Search, Settings, Settings2, Share, Share2, Shield, ShieldAlert, ShieldCheck, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Star, Tag, Target, Timer, Trash2, TrendingDown, TrendingUp, TriangleAlert, Trophy, Truck, Twitter, Type, Upload, User, UserX, Users, Video, Volume2, VolumeX, Wallet, Wand2, Wind, X, XCircle, Zap } = L; export default L;",
      },
    };
  }
}

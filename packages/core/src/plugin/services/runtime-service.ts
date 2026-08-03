import { RuntimeModuleKind } from '@core/plugin/services/enums/runtime-module-kind.enum';
import { Logger } from '@core/logging';

import { RuntimeConstants } from '@core/constants/runtime.constants';
import { RuntimeRegistryAccess } from '@core/runtime-registry-access';
import { IconBridgeTemplate } from '@core/plugin/services/bridges/icon-bridge-template';
import { LibBridgeTemplate } from '@core/plugin/services/bridges/lib-bridge-template';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IRuntimeModuleConfig } from '@core/plugin/services/interfaces/runtime-module-config.interface';

// React runtime bridge exports — framework integration API only.
// All registration and hook access must go through ContextBridge.* and ContextHooks.* class-based namespaces.
// Utility access is via SDK class names in RuntimeConstants.SDK_UTIL_CLASS_NAMES (CoercionUtils, etc.)

// SDK constants and utility classes available to plugin sandboxes.
// Plugin code uses class methods: CoercionUtils.toNumber(), StringUtils.slugify(), etc.

// Every reactor export, so externalized appearance bundles get the SAME decorator/base instances as the admin
// (discovery can't `require('@fromcode119/reactor')` — its dist barrel is bundler-only, extensionless).

export class RuntimeService {
  private static readonly REACT_RUNTIME_EXPORT_KEYS = [
  'Slot',
  'Override',
  'PluginsProvider',
  'getIcon',
  'createProxyIcon',
  'FrameworkIcons',
  'FrameworkIconRegistry',
  'IconNames',
  'ContextBridge',
  'PluginUiRegistrar',
  'ContextHooks',
  'SystemShortcodes',
] as const;
  private static readonly REACT_BROWSER_RUNTIME_EXPORT_KEYS = [
  'useState',
  'useEffect',
  'useMemo',
  'useCallback',
  'useContext',
  'createContext',
  'useRef',
  'useReducer',
  'useLayoutEffect',
  'useInsertionEffect',
  'useImperativeHandle',
  'useDebugValue',
  'forwardRef',
  'version',
  'memo',
  'Suspense',
  'Fragment',
  'Children',
  'Component',
  'PureComponent',
  'createElement',
  'cloneElement',
  'isValidElement',
  'startTransition',
  'useTransition',
  'useDeferredValue',
  'useId',
  'useSyncExternalStore',
] as const;
  private static readonly SDK_RUNTIME_EXPORT_KEYS = [
  'SystemConstants',
  'resolveRelationValue',
  ...RuntimeConstants.SDK_UTIL_CLASS_NAMES,
] as const;
  private static readonly REACTOR_RUNTIME_EXPORT_KEYS = [
  'Reactor', 'PureReactor', 'Provider', 'Context', 'Transition', 'Registry', 'html', 'Enum', 'Protocol',
  'implement', 'bound', 'watch', 'state', 'prop', 'ref', 'template', 'ReactiveMetadata', 'Platform',
] as const;
  private static readonly mergeModuleKeys = (discovered: string[], required: readonly string[]): string[] =>
  Array.from(new Set([...(Array.isArray(discovered) ? discovered : []), ...required]));

  private registry: Map<string, IRuntimeModuleConfig> = new Map();
  private logger = new Logger({ namespace: 'runtime-service' });

  constructor(private rootDir: string) {
    this.initializeDefaultRegistry();
  }

  private discoverModuleKeys(name: string, type: RuntimeModuleKind = RuntimeModuleKind.LIB): string[] {
    try {
      // Anchor paths for module resolution. Node will crawl up from these locations.
      const searchPaths = [process.cwd(), this.rootDir, __dirname];
      const modulePath = require.resolve(name, { paths: searchPaths });

      const mod = require(modulePath);
      const keys = Object.keys(mod);
      
      if (RuntimeModuleKind.resolve(type) === RuntimeModuleKind.ICON) {
        // Lucide icons are PascalCase
        return keys.filter(k => k.length >= 1 && k[0] === k[0].toUpperCase() && k !== 'default');
      }
      return keys;
    } catch (e) {
      if (type !== RuntimeModuleKind.ICON) {
        this.logger.warn(`Could not resolve module ${name} for discovery`);
      }
      return [];
    }
  }

  private initializeDefaultRegistry() {
    // Standard UI libraries - Discovery allows version-agnostic export mapping
    this.registry.set('react', {
      type: RuntimeModuleKind.LIB,
      keys: RuntimeService.mergeModuleKeys(this.discoverModuleKeys('react'), RuntimeService.REACT_BROWSER_RUNTIME_EXPORT_KEYS)
    });
    this.registry.set('react-dom', {
      type: RuntimeModuleKind.LIB,
      keys: this.discoverModuleKeys('react-dom') || ['render', 'hydrate', 'createPortal', 'createRoot']
    });
    this.registry.set('react-dom/client', {
      type: RuntimeModuleKind.LIB,
      keys: this.discoverModuleKeys('react-dom/client') || ['createRoot', 'hydrateRoot']
    });

    // Framework modules - We trust @fromcode119/sdk and @fromcode119/react to be available
    this.registry.set('@fromcode119/react', {
      type: RuntimeModuleKind.LIB,
      // Keep core bridge exports stable even if local package discovery misses some names.
      keys: RuntimeService.mergeModuleKeys(this.discoverModuleKeys('@fromcode119/react'), RuntimeService.REACT_RUNTIME_EXPORT_KEYS)
    });
    this.registry.set('@fromcode119/sdk', {
       type: RuntimeModuleKind.LIB,
       // Prevent runtime import failures for plugin bundles that import canonical SDK coercers.
       keys: RuntimeService.mergeModuleKeys(this.discoverModuleKeys('@fromcode119/sdk'), RuntimeService.SDK_RUNTIME_EXPORT_KEYS)
    });
    // reactor — externalized appearance bundles resolve it from the ONE shared runtime instance, so the
    // `@state`/`@watch` decorators (and the Reactor base) are the SAME instances the baked admin uses.
    this.registry.set('@fromcode119/reactor', {
      type: RuntimeModuleKind.LIB,
      keys: [...RuntimeService.REACTOR_RUNTIME_EXPORT_KEYS]
    });

    // JSX Runtimes (Internal React usage)
    this.registry.set('react-jsx', { type: RuntimeModuleKind.LIB, keys: [] });
    this.registry.set('react/jsx-runtime', { type: RuntimeModuleKind.LIB, keys: ['jsx', 'jsxs', 'Fragment'] });
    this.registry.set('react/jsx-dev-runtime', { type: RuntimeModuleKind.LIB, keys: ['jsxDEV', 'Fragment'] });

    // Core Admin Modules (Driven by SDK constants)
    this.registry.set(RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS, {
      type: RuntimeModuleKind.LIB,
      keys: [...RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS]
    });
    this.registry.set(RuntimeConstants.MODULE_NAMES.ADMIN, {
      type: RuntimeModuleKind.LIB,
      keys: [...RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS]
    });

    // Icons
    const lucideKeys = this.discoverModuleKeys('lucide-react', RuntimeModuleKind.ICON);
    this.registry.set('lucide-react', {
      type: RuntimeModuleKind.ICON,
      keys: lucideKeys
    });
  }

  public registerModule(name: string, config: IRuntimeModuleConfig) {
    this.registry.set(name, config);
  }

  public generateBridgeSource(name: string, config: any): string | null {
    if (config.url) return null;

    // NOTE: there is deliberately no `react/jsx-runtime` branch here. Those three names
    // (`react-jsx`, `react/jsx-runtime`, `react/jsx-dev-runtime`) are permanent members of
    // `RuntimeConstants.CLIENT_HANDLED_MODULES`, and every caller of this method skips that set — so the
    // branch was unreachable. The JSX runtime the browser actually receives is the inline `data:` URL
    // built by `ImportMapInstaller.buildStaticImports`. Keeping a second copy here only invited the two
    // to drift apart (they already had).
    let source = '';
    if (config.type === 'icon') {
      // Icons resolve through the single runtime registry's bridge (getIcon), not a bare window global.
      const bridgeExpr = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT_BRIDGE);
      const exports = (config.keys || [])
        .map((key: string) => `export const ${key} = (${bridgeExpr}).getIcon('${key}');`)
        .join('\n');

      source = IconBridgeTemplate.SOURCE.replace('{{EXPORTS}}', exports);
    } else {
      // Everything resolves through the ONE namespaced runtime registry — no `window.Fromcode`/`window.React`.
      let globalObject = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT_BRIDGE);

      if (name === 'react') {
        globalObject = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT);
      } else if (name.startsWith('react-dom')) {
        globalObject = RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT_DOM);
      } else if (name.startsWith('@fromcode119/')) {
        // Resolve the module's own registry entry, falling back to the react bridge.
        globalObject = `${RuntimeRegistryAccess.accessorExpr(name)} || ${RuntimeRegistryAccess.accessorExpr(RuntimeRegistryAccess.KEYS.REACT_BRIDGE)}`;

        // Special case for admin components which might be bundled together
        if (name === RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS || name === RuntimeConstants.MODULE_NAMES.ADMIN) {
          globalObject = `(${RuntimeRegistryAccess.accessorExpr(RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS)} || ${RuntimeRegistryAccess.accessorExpr(RuntimeConstants.MODULE_NAMES.ADMIN)})`;
        }
      }

      const scopedGlobalObject = `(${globalObject})`;

      const exports = (config.keys || [])
        .map((key: string) => `export const ${key} = ${scopedGlobalObject} ? ${scopedGlobalObject}['${key}'] : undefined;`)
        .join('\n');

      source = LibBridgeTemplate.SOURCE
        .replace('{{EXPORTS}}', exports)
        .replace(/{{SCOPE}}/g, scopedGlobalObject);
    }

    if (!source) return null;
    return Buffer.from(source).toString('base64');
  }

  public getModules(activePlugins: ILoadedPlugin[]): Record<string, any> {
    const modules: Record<string, any> = {};

    // 1. From registry (System defaults)
    // Client-handled modules (react, lucide-react, @fromcode119/* etc.) are always provided
    // via hardcoded data: URLs in ImportMapInstaller.buildStaticImports — skip them entirely
    // to avoid sending 2.9 MB of unused bridge source on every /system/frontend request.
    for (const [name, config] of this.registry.entries()) {
      if (RuntimeConstants.CLIENT_HANDLED_MODULES.has(name)) continue;
      modules[name] = { 
        ...config,
        source: this.generateBridgeSource(name, config)
      };
    }

    // 2. From plugins
    activePlugins.forEach(p => {
      if (!p.manifest.runtimeModules) return;

      if (Array.isArray(p.manifest.runtimeModules)) {
        p.manifest.runtimeModules.forEach(name => {
          if (RuntimeConstants.CLIENT_HANDLED_MODULES.has(name)) return;
          if (!modules[name]) {
            const config: IRuntimeModuleConfig = { keys: [], type: RuntimeModuleKind.LIB };
            modules[name] = { ...config, source: this.generateBridgeSource(name, config) };
          }
        });
      } else {
        Object.entries(p.manifest.runtimeModules).forEach(([name, val]) => {
          if (RuntimeConstants.CLIENT_HANDLED_MODULES.has(name)) return;
          // If the module already exists in our registry, don't overwrite it with a generic one
          if (modules[name] && typeof val === 'string' && modules[name].type === val) {
             return;
          }

          if (typeof val === 'string' && (val.startsWith('/') || val.startsWith('http'))) {
            modules[name] = { url: val };
          } else if (typeof val === 'object' && val !== null) {
            const config = val as any;
            modules[name] = { ...config, source: this.generateBridgeSource(name, config) };
          } else {
            const config: IRuntimeModuleConfig = { keys: [], type: (val as any) || 'lib' };
            modules[name] = { ...config, source: this.generateBridgeSource(name, config) };
          }
        });
      }
    });

    return modules;
  }

  public get runtimeModules(): Record<string, any> {
      // This is a helper for legacy access, but it needs the active plugins.
      // Since RuntimeService doesn't track active plugins itself anymore,
      // we'll return a proxy or just expect the manager to call getModules()
      // For simplicity in the short term, we'll keep getModules() as the main API.
      // But PluginManager expects .runtime.runtimeModules.
      // We can make it a property that PluginManager updates, OR just keep it getter-less and update PluginManager.
      return {}; 
  }
}
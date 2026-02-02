import fs from 'fs';
import path from 'path';
import { Logger } from '../../logging/logger';
import { LoadedPlugin } from '../../types';

export interface RuntimeModuleConfig {
  keys: string[];
  type: 'icon' | 'lib';
}

export class RuntimeService {
  private registry: Map<string, RuntimeModuleConfig> = new Map();
  private templates: Record<string, string> = {};
  private logger = new Logger({ namespace: 'RuntimeService' });

  constructor(rootDir: string) {
    this.templates = this.loadBridgeTemplates(rootDir);
    this.initializeDefaultRegistry();
  }

  private discoverModuleKeys(name: string, type: 'icon' | 'lib' = 'lib'): string[] {
    try {
      const modulePath = require.resolve(name, { paths: [process.cwd()] });
      const mod = require(modulePath);
      const keys = Object.keys(mod);
      
      if (type === 'icon') {
          return keys.filter(k => k[0] === k[0].toUpperCase());
      }
      return keys;
    } catch (e) {
      return [];
    }
  }

  private initializeDefaultRegistry() {
    this.registry.set('react', { 
      type: 'lib', 
      keys: ['useState', 'useEffect', 'useMemo', 'useCallback', 'useContext', 'createContext', 'useRef', 'useLayoutEffect', 'useImperativeHandle', 'useDebugValue', 'forwardRef', 'version', 'memo', 'Suspense', 'Fragment'] 
    });
    this.registry.set('react-dom', { 
      type: 'lib', 
      keys: ['render', 'hydrate', 'createPortal', 'createRoot'] 
    });
    this.registry.set('react-dom/client', { 
      type: 'lib', 
      keys: ['createRoot', 'hydrateRoot'] 
    });
    this.registry.set('@fromcode/react', { 
      type: 'lib', 
      keys: [
        'Slot', 'Override', 'usePlugins', 'useTranslation', 'PluginsProvider', 
        'getIcon', 'createProxyIcon', 'FrameworkIcons', 'FrameworkIconRegistry', 'IconNames',
        'registerSlotComponent', 'registerFieldComponent', 'registerOverride', 'registerMenuItem', 
        'registerCollection', 'registerPlugins', 'registerTheme', 'registerSettings', 
        'registerAPI', 'getAPI', 'loadConfig', 'resolveContent', 'api', 'emit', 'on', 't', 
        'locale', 'setLocale', 'usePluginAPI'
      ] 
    });
    this.registry.set('react-jsx', { type: 'lib', keys: [] });
    this.registry.set('react/jsx-runtime', { type: 'lib', keys: ['jsx', 'jsxs', 'Fragment'] });
    this.registry.set('react/jsx-dev-runtime', { type: 'lib', keys: ['jsxDEV', 'Fragment'] });
    
    // Auto-discover Lucide icons if available, otherwise fallback to standard set
    const fallbackLucideKeys = ['Dashboard', 'Plugins', 'Users', 'Settings', 'Media', 'Layout', 'System', 'Package', 'Menu', 'Search', 'Sun', 'Moon', 'Bell', 'User', 'Logout', 'Help', 'Down', 'Up', 'Right', 'Left', 'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight', 'ArrowLeft', 'ArrowRight', 'Close', 'X', 'Home', 'Plus', 'Trash', 'Edit', 'Save', 'Download', 'Upload', 'Refresh', 'External', 'ExternalLink', 'More', 'MoreVertical', 'Filter', 'Calendar', 'UserCheck', 'Eye', 'Globe', 'Palette', 'Smartphone', 'Layers', 'Share', 'Copy', 'Maximize', 'PlusCircle', 'Minus', 'Check', 'Alert', 'Warning', 'Info', 'Loader', 'Loader2', 'File', 'FileText', 'Text', 'Folder', 'Grid', 'List', 'FolderPlus', 'Box', 'ShoppingBag', 'Database', 'Terminal', 'Activity', 'Clock', 'History', 'TrendingUp', 'CheckSquare', 'Code', 'Chart', 'LayoutGrid', 'Columns', 'Quote', 'Star', 'BarChart', 'BarChart3', 'ArrowUpRight', 'Mail', 'Lock', 'Shield', 'ShieldCheck', 'ShieldAlert', 'UserPlus', 'Orbit', 'Zap', 'Tag'];
    
    let lucideKeys = this.discoverModuleKeys('lucide-react', 'icon');
    if (lucideKeys.length === 0) lucideKeys = fallbackLucideKeys;

    this.registry.set('lucide-react', { 
      type: 'icon', 
      keys: [...new Set([...fallbackLucideKeys, ...lucideKeys])]
    });
  }

  private loadBridgeTemplates(rootDir: string): Record<string, string> {
    const templates: Record<string, string> = {};
    const bridgesDir = path.join(rootDir, 'packages/core/bridges');
    
    try {
      if (fs.existsSync(bridgesDir)) {
        const files = fs.readdirSync(bridgesDir);
        files.forEach(file => {
          if (file.endsWith('.js')) {
            const name = file.replace('.js', '');
            templates[name] = fs.readFileSync(path.join(bridgesDir, file), 'utf8');
          }
        });
      }
    } catch (err) {
      this.logger.warn('Failed to load bridge templates:', err);
    }
    
    return templates;
  }

  public registerModule(name: string, config: RuntimeModuleConfig) {
    this.registry.set(name, config);
  }

  public generateBridgeSource(name: string, config: any): string | null {
    if (config.url) return null;

    let source = '';
    if (name === 'react-jsx' || name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') {
      source = this.templates['jsx'] || '';
    } else if (config.type === 'icon') {
      const exports = (config.keys || [])
        .map((key: string) => `export const ${key} = window.Fromcode.getIcon('${key}');`)
        .join('\n');
      
      source = (this.templates['icons'] || '').replace('{{EXPORTS}}', exports);
    } else {
      const globalObject = {
        'react': 'window.React',
        'react-dom': 'window.ReactDOM || window.ReactDom',
        'react-dom/client': 'window.ReactDOM || window.ReactDom',
        '@fromcode/react': 'window.Fromcode'
      }[name] || 'window.Fromcode';

      const exports = (config.keys || [])
        .map((key: string) => `export const ${key} = ${globalObject}['${key}'];`)
        .join('\n');

      source = (this.templates['lib'] || '')
        .replace('{{EXPORTS}}', exports)
        .replace(/{{SCOPE}}/g, globalObject);
    }

    if (!source) return null;
    return Buffer.from(source).toString('base64');
  }

  public getModules(activePlugins: LoadedPlugin[]): Record<string, any> {
    const modules: Record<string, any> = {};

    // 1. From registry
    for (const [name, config] of this.registry.entries()) {
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
          if (!modules[name]) {
            const config: RuntimeModuleConfig = { keys: [], type: 'lib' };
            modules[name] = { ...config, source: this.generateBridgeSource(name, config) };
          }
        });
      } else {
        Object.entries(p.manifest.runtimeModules).forEach(([name, val]) => {
          if (typeof val === 'string' && (val.startsWith('/') || val.startsWith('http'))) {
            modules[name] = { url: val };
          } else if (typeof val === 'object' && val !== null) {
            const config = val as any;
            modules[name] = { ...config, source: this.generateBridgeSource(name, config) };
          } else {
            const config: RuntimeModuleConfig = { keys: [], type: (val as any) || 'lib' };
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

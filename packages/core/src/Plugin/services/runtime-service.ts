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
  private logger = new Logger({ namespace: 'runtime-service' });

  constructor(private rootDir: string) {
    this.templates = this.loadBridgeTemplates(rootDir);
    this.initializeDefaultRegistry();
  }

  private discoverModuleKeys(name: string, type: 'icon' | 'lib' = 'lib'): string[] {
    try {
      // Anchor paths for module resolution. Node will crawl up from these locations.
      const searchPaths = [process.cwd(), this.rootDir, __dirname];
      const modulePath = require.resolve(name, { paths: searchPaths });

      const mod = require(modulePath);
      const keys = Object.keys(mod);
      
      if (type === 'icon') {
          // Lucide icons are PascalCase
          return keys.filter(k => k.length >= 1 && k[0] === k[0].toUpperCase() && k !== 'default');
      }
      return keys;
    } catch (e) {
      this.logger.warn(`Could not resolve module ${name} for discovery`);
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
        'slot', 'override', 'usePlugins', 'useTranslation', 'PluginsProvider', 
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
    
    // Core Admin Components (Available as a bridge for plugins)
    this.registry.set('@fromcode/admin/components', {
      type: 'lib',
      keys: [
        'MediaPicker', 'Button', 'Input', 'TextArea', 'Select', 'TagField', 'Loader', 'Switch', 
        'Card', 'Badge', 'ConfirmDialog', 'PromptDialog', 'DateTimePicker', 
        'ColorPicker', 'CodeEditor', 'VisualMenuField', 'Icon', 'ThemeContext', 'NotificationContext'
      ]
    });
    
    // Auto-discover Lucide icons
    const lucideKeys = this.discoverModuleKeys('lucide-react', 'icon');

    this.registry.set('lucide-react', { 
      type: 'icon', 
      keys: lucideKeys
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
        '@fromcode/react': 'window.Fromcode',
        '@fromcode/admin/components': 'window.FromcodeAdmin'
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

    // 1. From registry (System defaults)
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

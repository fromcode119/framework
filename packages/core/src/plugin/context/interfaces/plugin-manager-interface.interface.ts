import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { PluginContext } from '@core/plugin-context';

export interface IPluginManagerInterface {
  hooks: any;
  apiHost: any;
  db: any;
  audit: any;
  integrations: any;
  jobs: any;
  scheduler: any;
  redis?: any;
  auth: any;
  i18n: any;
  middlewares: any;
  plugins: Map<string, ILoadedPlugin>;
  pluginsRoot: string;
  registeredCollections: Map<string, any>;
  headInjections: Map<string, any[]>;
  schemaManager: any;
  runtime: any;
  themeManager?: {
    getActiveThemeManifest(): { slug: string } | null;
    getThemeConfig(slug: string): Promise<any>;
  };
  getPlugins(): ILoadedPlugin[];
  enable(slug: string): Promise<void>;
  disable(slug: string, options?: { persistState?: boolean }): Promise<void>;
  delete(slug: string): Promise<void>;
  getHeadInjections(slug: string): any[];
  savePluginConfig(slug: string, config: any): Promise<void>;
  getCollections(): any[];
  getCollection(slug: string): any | undefined;
  registerPluginSettings(pluginSlug: string, schema: any): void;
  getPluginSettings(pluginSlug: string): any | undefined;
  installFromZip(filePath: string, pluginsRoot?: string): Promise<any>;
  writeLog(level: string, message: string, pluginSlug?: string, context?: any): Promise<void>;
  disableWithError(slug: string, message: string): Promise<void>;
  installExtensionArchive(
    filePath: string,
    type: ExtensionScope,
    options?: { enable?: boolean; activate?: boolean }
  ): Promise<any>;
  emit(event: string, payload: any): void;
  getImportMap(): { imports: Record<string, string> };
  getRuntimeModules(): Record<string, any>;
  getAdminMetadata(): Promise<any>;
  updatePlugin(slug: string, pkg: any): Promise<void>;
  createContext(plugin: ILoadedPlugin): PluginContext;
  setAuth(auth: any): void;
  setApiHost(host: any): void;
}

import { LoadedPlugin, PluginContext } from '../../types';
import { Logger } from '@fromcode/sdk';
import { PluginPermissionsService } from '../../security/plugin-permissions-service';

export interface PluginManagerInterface {
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
  plugins: Map<string, LoadedPlugin>;
  pluginsRoot: string;
  registeredCollections: Map<string, any>;
  headInjections: Map<string, any[]>;
  runtime: any;
  getPlugins(): LoadedPlugin[];
  enable(slug: string): Promise<void>;
  disable(slug: string): Promise<void>;
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
  emit(event: string, payload: any): void;
  getImportMap(): { imports: Record<string, string> };
  getRuntimeModules(): Record<string, any>;
  getAdminMetadata(): any;
  updatePlugin(slug: string, pkg: any): Promise<void>;
  createContext(plugin: LoadedPlugin): PluginContext;
  setAuth(auth: any): void;
  setApiHost(host: any): void;
}

export function createSecurityHelpers(plugin: LoadedPlugin, manager: PluginManagerInterface, rootLogger: Logger) {
  const hasCapability = (cap: string) =>
    PluginPermissionsService.hasPermission(plugin.manifest, cap) ||
    plugin.manifest.capabilities?.includes('*');

  const handleViolation = (cap: string) => {
    rootLogger.error(`Security Violation: Plugin "${plugin.manifest.slug}" attempted to use "${cap}" without declaration.`);
    manager.audit.logAction(plugin.manifest.slug, 'Capability Check', cap, 'violation');
    manager.disableWithError(plugin.manifest.slug, `Security Violation: Missing "${cap}" capability.`);
    throw new Error(`Security Violation: Missing "${cap}" capability.`);
  };

  const handleRateLimit = (type: string) => {
    rootLogger.warn(`Rate Limit Exceeded: Plugin "${plugin.manifest.slug}" reached ${type} quota.`);
    manager.audit.logAction(plugin.manifest.slug, 'Rate Limit', type, 'denied');
    throw new Error(`Rate Limit Exceeded: Plugin "${plugin.manifest.slug}" reached ${type} quota.`);
  };

  return { hasCapability, handleViolation, handleRateLimit };
}

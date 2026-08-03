import { Enum } from '@fromcode119/reactor';

/**
 * A capability a plugin must DECLARE in its manifest before the framework grants it.
 *
 * Manifests are JSON, so the declared set arrives as raw strings — cross that boundary with `.value`
 * (or `has()`), never by comparing a member to a manifest entry.
 */
export class PluginCapability extends Enum {
  static readonly API = new PluginCapability('api');
  static readonly DATABASE = new PluginCapability('database');
  static readonly DATABASE_READ = new PluginCapability('database:read');
  static readonly DATABASE_WRITE = new PluginCapability('database:write');
  static readonly FILESYSTEM_READ = new PluginCapability('filesystem:read');
  static readonly FILESYSTEM_WRITE = new PluginCapability('filesystem:write');
  static readonly NETWORK = new PluginCapability('network');
  static readonly PLUGINS = new PluginCapability('plugins:interact');
  static readonly EXTENSIONS_MANAGE = new PluginCapability('extensions:manage');
  static readonly HOOKS = new PluginCapability('hooks');
  static readonly EMAIL = new PluginCapability('email');
  static readonly CACHE = new PluginCapability('cache');
  static readonly I18N = new PluginCapability('i18n');
  static readonly CONTENT = new PluginCapability('content');
  static readonly JOBS = new PluginCapability('jobs');
  static readonly SCHEDULER = new PluginCapability('scheduler');
  static readonly REDIS_GLOBAL = new PluginCapability('redis:global');

  private constructor(value: string) {
    super(value);
  }
}

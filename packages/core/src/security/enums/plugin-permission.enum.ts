import { Enum } from '@fromcode119/reactor';

/**
 * A capability a plugin manifest may declare. Compared against manifest strings, so members are
 * matched through {@link resolve} rather than by `===` against a raw literal.
 */
export class PluginPermission extends Enum {
  static readonly DATABASE_READ = new PluginPermission('database:read');
  static readonly DATABASE_WRITE = new PluginPermission('database:write');
  static readonly DATABASE_ALL = new PluginPermission('database:*');
  static readonly API_ROUTES = new PluginPermission('api:routes');
  static readonly NAVIGATION = new PluginPermission('navigation');
  static readonly HOOKS = new PluginPermission('hooks');
  static readonly ADMIN_UI = new PluginPermission('admin:ui');
  static readonly COLLECTIONS_MODIFY = new PluginPermission('collections:modify');
  static readonly FILE_READ = new PluginPermission('file:read');
  static readonly FILE_WRITE = new PluginPermission('file:write');
  static readonly NETWORK_OUTBOUND = new PluginPermission('network:outbound');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw manifest string to a member, or `undefined` when it names no known permission. */
  static resolve(value: unknown): PluginPermission | undefined {
    if (value instanceof PluginPermission) return value;
    return PluginPermission.fromValue(String(value ?? '').trim()) as PluginPermission | undefined;
  }
}

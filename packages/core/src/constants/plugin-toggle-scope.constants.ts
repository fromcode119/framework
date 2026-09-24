/**
 * The `scope` a plugin toggle request names. `PLATFORM` is the operator-wide axis — is the plugin loadable
 * at all — and is refused for anyone but a platform admin. Without it, a toggle on a multi-tenant deployment
 * means "for the site I am in" (or the platform axis when no site is bound).
 */
export class PluginToggleScopeConstants {
  static readonly PLATFORM = 'platform';
}

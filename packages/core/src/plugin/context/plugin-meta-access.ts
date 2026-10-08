import type { IPluginContextMeta } from '@core/plugin/interfaces/plugin-context-meta.interface';
import { SecretService } from '@core/security/secret-service';

/**
 * What a PLUGIN may do with `_system_meta` through `context.meta`.
 *
 * The table is the framework's own key-value store, and it holds far more than settings: the platform's
 * signing root (`system:signing_secret`), each account's two-step secret and flag
 * (`user:<id>:totp_secret`, `user:<id>:2fa_enabled`), password-reset tokens
 * (`auth:password_reset_token:<hash>`), the SCIM token, API-key lookups, and every integration's
 * credentials. Unguarded, `meta.get` + `secrets.decrypt` handed a plugin all of it, and `meta.set` let
 * it mint a reset link for the administrator, switch off someone's two-step sign-in, or rewrite
 * `site_url` / `maintenance_mode` for the whole platform.
 *
 * - READ: the framework's account and credential namespaces are refused outright. Anything else may be
 *   read, but a key the plugin does not own comes back with every encrypted value masked — plugins
 *   legitimately read the active integration's plain fields (sender address, provider key), never its
 *   secrets.
 * - WRITE (`set`, `advanceCounter`): only the plugin's own keys, `<slug>:…` or `<slug>.…`.
 *
 * The framework's own callers use `MetaContextProxy.createMetaProxy` directly and are unaffected.
 */
export class PluginMetaAccess {
  /** Account, session and credential state. Never readable or writable by a plugin. */
  private static readonly RESERVED_PREFIXES = ['system:', 'user:', 'auth:', 'scim:', 'mcp:'];

  static wrap(meta: IPluginContextMeta, pluginSlug: string): IPluginContextMeta {
    const slug = String(pluginSlug ?? '').trim().toLowerCase();
    return {
      async get(key: string): Promise<string | null> {
        const normalized = PluginMetaAccess.unreserved(key, 'get');
        const value = await meta.get(normalized);
        return PluginMetaAccess.owns(slug, normalized) ? value : PluginMetaAccess.masked(value);
      },
      // async, so a refusal REJECTS: a plugin's `meta.set(...).catch(...)` must see it, not a sync throw.
      async set(key: string, value: unknown): Promise<void> {
        return meta.set(PluginMetaAccess.ownKey(slug, key, 'set'), value);
      },
      async advanceCounter(key: string, startFloor?: number, maxAttempts?: number): Promise<number> {
        return meta.advanceCounter(PluginMetaAccess.ownKey(slug, key, 'advanceCounter'), startFloor, maxAttempts);
      },
    };
  }

  private static unreserved(key: unknown, operation: string): string {
    const normalized = String(key ?? '');
    const lowered = normalized.trim().toLowerCase();
    if (PluginMetaAccess.RESERVED_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
      throw new Error(`context.meta.${operation} refused "${normalized}": account and credential keys belong to the framework.`);
    }
    return normalized;
  }

  private static ownKey(slug: string, key: unknown, operation: string): string {
    const normalized = PluginMetaAccess.unreserved(key, operation);
    if (!PluginMetaAccess.owns(slug, normalized)) {
      throw new Error(
        `context.meta.${operation} refused "${normalized}": a plugin writes only its own keys ("${slug}:…" or "${slug}.…").`,
      );
    }
    return normalized;
  }

  private static owns(slug: string, key: string): boolean {
    const lowered = key.trim().toLowerCase();
    return !!slug && (lowered.startsWith(`${slug}:`) || lowered.startsWith(`${slug}.`));
  }

  /** The value with every encrypted secret in it — top-level or nested in JSON — replaced by the mask. */
  private static masked(value: string | null): string | null {
    if (value == null || !SecretService.carriesEncryptedValue(value)) return value;
    if (SecretService.isEncryptedValue(value)) return SecretService.maskIfPresent(value);
    try {
      return JSON.stringify(PluginMetaAccess.maskTree(JSON.parse(value)));
    } catch {
      // Not JSON, yet carries ciphertext somewhere: nothing of it can be handed out safely.
      return SecretService.maskIfPresent(value);
    }
  }

  private static maskTree(node: unknown): unknown {
    if (typeof node === 'string') return SecretService.carriesEncryptedValue(node) ? SecretService.maskIfPresent(node) : node;
    if (Array.isArray(node)) return node.map((entry) => PluginMetaAccess.maskTree(entry));
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([field, entry]) => [field, PluginMetaAccess.maskTree(entry)]));
    }
    return node;
  }
}

import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginRemoteCallRoot } from '@core/plugin/host/enums/plugin-remote-call-root.enum';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { IPluginRemoteCall } from '@core/plugin/host/interfaces/plugin-remote-call.interface';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';

/** The host-side allowlist for code uploaded by one site. Guest code cannot bypass this over RPC. */
export class TenantPluginRuntimePolicy {
  private static readonly CONTEXT_METHODS = new Map<string, ReadonlySet<string>>([
    ['auth', new Set(['actor', 'verifyToken'])],
    ['cache', new Set(['del', 'get', 'set'])],
    ['hooks', new Set(['call', 'emit'])],
    ['i18n', new Set(['registerTranslations', 'siteClock'])],
    ['paths', new Set(['readCurrentPluginJson', 'readCurrentPluginTemplate', 'readCurrentPluginText', 'resolveActiveThemeRoot', 'resolveActiveThemeSlug'])],
    ['settings', new Set(['get', 'register', 'update'])],
    ['tenants', new Set(['baseUrls', 'current', 'isMultiSite'])],
    ['theme', new Set(['getActiveConfig', 'getActiveSlug', 'getCurrentPluginSettings', 'getVariables'])],
  ]);

  private static readonly REGISTRATIONS = new Set<string>([
    String(PluginGuestRegistrationKind.ROUTE.value),
    String(PluginGuestRegistrationKind.USE.value),
    String(PluginGuestRegistrationKind.MIDDLEWARE.value),
    String(PluginGuestRegistrationKind.HOOK.value),
    String(PluginGuestRegistrationKind.HOOK_OFF.value),
    String(PluginGuestRegistrationKind.DECLARATION.value),
  ]);

  private static readonly DECLARATIONS = new Map<string, ReadonlySet<string>>([
    ['i18n', new Set(['registerTranslations'])],
    ['settings', new Set(['register'])],
  ]);

  static assertRemoteCall(slug: string, call: Pick<IPluginRemoteCall, 'root' | 'steps'>): void {
    if (!PluginOwners.ownerOf(slug)) return;
    if (call.root !== String(PluginRemoteCallRoot.CONTEXT.value)) {
      TenantPluginRuntimePolicy.refuse(slug, `${call.root}.*`);
    }
    TenantPluginRuntimePolicy.assertContextCall(slug, call.steps);
  }

  static assertRegistration(slug: string, registration: IPluginGuestRegistration): void {
    if (!PluginOwners.ownerOf(slug)) return;
    if (!TenantPluginRuntimePolicy.REGISTRATIONS.has(registration.kind)) {
      TenantPluginRuntimePolicy.refuse(slug, `registration:${registration.kind}`);
    }
    if (registration.kind !== String(PluginGuestRegistrationKind.DECLARATION.value)) return;
    if ((registration.root ?? String(PluginRemoteCallRoot.CONTEXT.value)) !== String(PluginRemoteCallRoot.CONTEXT.value)) {
      TenantPluginRuntimePolicy.refuse(slug, `declaration:${registration.root}.*`);
    }
    TenantPluginRuntimePolicy.assertDeclaration(slug, registration.steps ?? []);
  }

  /**
   * Exactly `surface.method(...)`: a property read, a call on the surface itself, or a further step
   * into whatever an allowed method returned would all reach past the pair this list approves.
   */
  private static assertContextCall(slug: string, steps: IPluginRemoteCall['steps']): void {
    const surface = String(steps[0]?.name ?? '');
    const method = String(steps[1]?.name ?? '');
    if (steps.length !== 2 || steps[0]?.args || !steps[1]?.args) {
      TenantPluginRuntimePolicy.refuse(slug, `context.${surface || '*'}.${method || '*'} (only a direct method call is allowed)`);
    }
    if (!TenantPluginRuntimePolicy.CONTEXT_METHODS.get(surface)?.has(method)) {
      TenantPluginRuntimePolicy.refuse(slug, `context.${surface || '*'}.${method || '*'}`);
    }
    if (surface === 'hooks') TenantPluginRuntimePolicy.assertOwnEvent(slug, method, steps[1]?.args?.[0]);
  }

  /**
   * A site's plugin fires only ITS OWN events. The platform acts on others with no site in mind —
   * `system:cache:purge` empties every site's cache, `system:settings:updated` reloads the platform's
   * settings — and another plugin's event is that plugin's API, which a site's plugin does not call.
   * Listening is unaffected: a handler only ever hears its own site.
   */
  private static assertOwnEvent(slug: string, method: string, event: unknown): void {
    const name = String(event ?? '').trim().toLowerCase();
    const own = slug.trim().toLowerCase();
    if (name.startsWith(`${own}:`) || name.startsWith(`${own}.`)) return;
    TenantPluginRuntimePolicy.refuse(slug, `context.hooks.${method}("${name || '*'}") — only events named "${own}:…" are its own`);
  }

  private static assertDeclaration(slug: string, steps: NonNullable<IPluginGuestRegistration['steps']>): void {
    const surface = String(steps[0]?.name ?? '');
    const method = String(steps[1]?.name ?? '');
    if (!TenantPluginRuntimePolicy.DECLARATIONS.get(surface)?.has(method)) {
      TenantPluginRuntimePolicy.refuse(slug, `declaration:context.${surface || '*'}.${method || '*'}`);
    }
  }

  private static refuse(slug: string, target: string): never {
    throw Object.assign(
      new Error(`Security Violation: site-uploaded plugin "${slug}" cannot access ${target}.`),
      { code: 'tenant_plugin_runtime_denied', target },
    );
  }
}

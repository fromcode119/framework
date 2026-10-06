import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { IntegrationProfileService } from '@core/integrations/integration-profile-service';
import { IntegrationStoredProviderService } from '@core/integrations/integration-stored-provider-service';
import type { IIntegrationStoredProvider } from '@core/integrations/interfaces/integration-stored-provider.interface';
import type { IIntegrationTypeRuntime } from '@core/integrations/interfaces/integration-type-runtime.interface';

/**
 * Lets a plugin put a STARTING entry into an integration type's list — "create it if it is missing, touch
 * nothing that exists" — so a seeded profile can point at it and the operator finishes the setup in
 * Settings → Integrations.
 *
 * Why this exists: a plugin used to write the framework's own storage key (`integration_<type>_providers`)
 * itself, because the framework's save path refuses an entry with an empty required field (it validates), and a
 * starting entry has no credentials yet. A plugin writing that key by hand also had to repeat the framework's
 * encryption and entry shape, and once blanked a site's saved credentials on a boot. This is that write, done
 * once, here:
 *
 * - it never replaces, edits or removes: an entry with the same id, or any entry of the same provider, wins;
 * - it appends to what is STORED, not to what is readable — an entry whose provider's plugin is switched off
 *   is invisible to readers and must still survive;
 * - secret fields are encrypted exactly as an admin save does it;
 * - on a multi-site deployment it writes only when a site is bound: with none, the row it would create belongs
 *   to nobody and nothing reads it (a type that is `platformOnly` is the exception — it IS configured once).
 */
export class IntegrationEntrySeeder {
  constructor(
    private readonly db: any,
    private readonly types: Map<string, IIntegrationTypeRuntime<any>>,
    private readonly profileService: IntegrationProfileService,
    private readonly stored: IntegrationStoredProviderService,
  ) {}

  async ensure(
    typeKey: string,
    entry: { id?: string; providerKey: string; name?: string; enabled?: boolean; config?: Record<string, any> },
  ): Promise<{ created: boolean; id: string; reason?: string }> {
    const type = this.profileService.normalize(typeKey);
    const runtime = this.types.get(type);
    if (!runtime) throw new Error(`Integration type "${type}" is not registered`);
    const providerKey = this.profileService.normalize(String(entry?.providerKey || ''));
    const provider = runtime.providers.get(providerKey);
    if (!provider) throw new Error(`Integration "${type}" provider "${providerKey}" is not registered`);

    if (TenantMode.isEnabled() && !RequestContextUtils.getTenantId() && !runtime.definition.platformOnly) {
      return { created: false, id: '', reason: 'no_site' };
    }

    const id = this.profileService.normalize(String(entry?.id || '')) || `${providerKey}-default`;
    const stored = await this.readStored(type);
    const present = stored.find((candidate) => candidate.id === id || candidate.providerKey === providerKey);
    if (present) return { created: false, id: present.id };

    const nowIso = new Date().toISOString();
    const next: IIntegrationStoredProvider = {
      id,
      name: String(entry?.name || '').trim() || provider.label,
      providerKey,
      config: this.stored.buildStoredConfig(type, provider, entry?.config || {}, {}),
      ...IntegrationStoredProviderService.namespaceOf(runtime, providerKey, null),
      enabled: entry?.enabled === undefined ? true : !!entry.enabled,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await this.profileService.upsertMeta({
      key: this.profileService.getProvidersSettingKey(type),
      value: JSON.stringify({ providers: [...stored, next] }),
      group: 'integrations',
      description: `Provider configurations for ${type} integration.`,
    });
    return { created: true, id };
  }

  /** Every stored entry, including those whose provider is not registered right now. */
  private async readStored(type: string): Promise<IIntegrationStoredProvider[]> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: this.profileService.getProvidersSettingKey(type) });
    const raw = String(row?.value || '').trim();
    if (!raw) return [];
    const parsed = this.profileService.safeParseJson(raw, []);
    const source = Array.isArray(parsed?.providers) ? parsed.providers : Array.isArray(parsed) ? parsed : [];
    return source.filter(Boolean);
  }
}

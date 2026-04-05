/** Integration profile and persistence service. Extracted from IntegrationRegistry (ARC-007). */

import { Logger } from '../logging';
import { SystemConstants } from '../constants';
import { CoreServices } from '../services';
import {
  IntegrationTypeRuntime,
  IntegrationStoredProfile,
  IntegrationStoredProfiles,
  IntegrationStoredProvider,
  IntegrationProviderDefinition,
} from './integration-registry.interfaces';

export class IntegrationProfileService {
  constructor(
    private readonly db: any,
    private readonly logger: Logger,
    private readonly types: Map<string, IntegrationTypeRuntime<any>>,
  ) {}

  // --- Profile management ---

  async setActiveProfile(typeKey: string, profileId: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProfileId = this.normalize(profileId);
    if (!normalizedProfileId) {
      throw new Error(`Profile id is required for integration "${normalizedType}".`);
    }

    const storedProfiles = await this.readStoredProfiles(normalizedType);
    if (!storedProfiles?.profiles?.length) {
      throw new Error(`Integration "${normalizedType}" has no stored profiles.`);
    }

    const targetProfile = storedProfiles.profiles.find((profile) => profile.id === normalizedProfileId);
    if (!targetProfile) {
      throw new Error(`Profile "${normalizedProfileId}" was not found for integration "${normalizedType}".`);
    }

    await this.writeStoredProfiles(normalizedType, {
      activeProfileId: normalizedProfileId,
      profiles: storedProfiles.profiles,
    });
  }

  async renameProfile(typeKey: string, profileId: string, profileName: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProfileId = this.normalize(profileId);
    const normalizedProfileName = String(profileName || '').trim();

    if (!normalizedProfileId) {
      throw new Error(`Profile id is required for integration "${normalizedType}".`);
    }
    if (!normalizedProfileName) {
      throw new Error(`Profile name is required for integration "${normalizedType}".`);
    }

    const storedProfiles = await this.readStoredProfiles(normalizedType);
    if (!storedProfiles?.profiles?.length) {
      throw new Error(`Integration "${normalizedType}" has no stored profiles.`);
    }

    const nowIso = new Date().toISOString();
    const updatedProfiles = storedProfiles.profiles.map((profile) => {
      if (profile.id !== normalizedProfileId) return profile;
      return { ...profile, name: normalizedProfileName, updatedAt: nowIso };
    });

    const exists = updatedProfiles.some((profile) => profile.id === normalizedProfileId);
    if (!exists) {
      throw new Error(`Profile "${normalizedProfileId}" was not found for integration "${normalizedType}".`);
    }

    await this.writeStoredProfiles(normalizedType, {
      activeProfileId: storedProfiles.activeProfileId || normalizedProfileId,
      profiles: updatedProfiles,
    });
  }

  async deleteProfile(typeKey: string, profileId: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProfileId = this.normalize(profileId);
    if (!normalizedProfileId) {
      throw new Error(`Profile id is required for integration "${normalizedType}".`);
    }

    const storedProfiles = await this.readStoredProfiles(normalizedType);
    if (!storedProfiles?.profiles?.length) {
      throw new Error(`Integration "${normalizedType}" has no stored profiles.`);
    }

    const remainingProfiles = storedProfiles.profiles.filter((profile) => profile.id !== normalizedProfileId);
    if (remainingProfiles.length === storedProfiles.profiles.length) {
      throw new Error(`Profile "${normalizedProfileId}" was not found for integration "${normalizedType}".`);
    }
    if (!remainingProfiles.length) {
      throw new Error(`Integration "${normalizedType}" must keep at least one profile.`);
    }

    const nextActiveProfileId =
      storedProfiles.activeProfileId === normalizedProfileId
        ? remainingProfiles[0].id
        : storedProfiles.activeProfileId;

    await this.writeStoredProfiles(normalizedType, {
      activeProfileId: nextActiveProfileId,
      profiles: remainingProfiles,
    });
  }

  // --- Private profile storage helpers ---

  async readStoredProfiles(typeKey: string): Promise<IntegrationStoredProfiles | null> {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) return null;

    try {
      const profilesRow = await this.db.findOne(SystemConstants.TABLE.META, { key: this.getProfilesSettingKey(normalizedType) });
      const rawProfiles = String(profilesRow?.value || '').trim();

      if (rawProfiles) {
        const parsed = this.safeParseJson(rawProfiles, {});
        const incomingProfiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
        const activeProfileId = this.normalize(String(parsed?.activeProfileId || '')) || '';
        const profiles: IntegrationStoredProfile[] = incomingProfiles
          .map((profile: any) => ({
            id: this.normalize(String(profile?.id || '')),
            name: String(profile?.name || '').trim() || 'Profile',
            providerKey: this.normalize(String(profile?.providerKey || '')),
            config: profile?.config && typeof profile.config === 'object' ? profile.config : {},
            createdAt: profile?.createdAt || undefined,
            updatedAt: profile?.updatedAt || undefined,
          }))
          .filter(
            (profile: IntegrationStoredProfile) =>
              !!profile.id && !!profile.providerKey && runtime.providers.has(profile.providerKey),
          );

        if (profiles.length) {
          return {
            activeProfileId: profiles.some((profile) => profile.id === activeProfileId)
              ? activeProfileId
              : profiles[0].id,
            profiles,
          };
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to read integration profiles for "${normalizedType}": ${error?.message || String(error)}`);
    }

    return null;
  }

  async writeStoredProfiles(typeKey: string, payload: IntegrationStoredProfiles) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const normalizedProfiles = (payload?.profiles || [])
      .map((profile) => ({
        id: this.normalize(String(profile?.id || '')),
        name: String(profile?.name || '').trim() || 'Profile',
        providerKey: this.normalize(String(profile?.providerKey || '')),
        config: profile?.config && typeof profile.config === 'object' ? profile.config : {},
        createdAt: profile?.createdAt,
        updatedAt: profile?.updatedAt,
      }))
      .filter(
        (profile) => !!profile.id && !!profile.providerKey && runtime.providers.has(profile.providerKey),
      );

    if (!normalizedProfiles.length) {
      throw new Error(`Integration "${normalizedType}" requires at least one valid profile.`);
    }

    const activeProfileId =
      this.normalize(payload?.activeProfileId || '') || normalizedProfiles[0].id;

    const selectedProfile =
      normalizedProfiles.find((profile) => profile.id === activeProfileId) || normalizedProfiles[0];

    await this.upsertMeta({
      key: this.getProfilesSettingKey(normalizedType),
      value: JSON.stringify({ activeProfileId: selectedProfile.id, profiles: normalizedProfiles }),
      group: 'integrations',
      description: `Profile configurations for ${normalizedType} integration providers.`,
    });
  }

  async upsertMeta(entry: { key: string; value: string; group?: string; description?: string }) {
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: entry.key });
    if (existing) {
      await this.db.update(
        SystemConstants.TABLE.META,
        { key: entry.key },
        {
          value: entry.value,
          group: entry.group || existing.group || null,
          description: entry.description || existing.description || null,
          updated_at: new Date(),
        },
      );
      return;
    }
    await this.db.insert(SystemConstants.TABLE.META, {
      key: entry.key,
      value: entry.value,
      group: entry.group || 'integrations',
      description: entry.description || null,
    });
  }

  getProvidersSettingKey(typeKey: string) { return `integration_${typeKey}_providers`; }
  getProfilesSettingKey(typeKey: string) { return `integration_${typeKey}_profiles`; }

  normalize(value: string) {
    return CoreServices.getInstance().content.sanitizeKey(value);
  }

  safeParseJson(value: string, fallback: any) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  validateProviderConfig(
    typeKey: string,
    provider: IntegrationProviderDefinition<any>,
    config: Record<string, any>,
  ) {
    for (const field of provider.fields || []) {
      const value = config?.[field.name];
      const isEmpty = value === undefined || value === null || String(value).trim() === '';
      if (field.required && isEmpty) {
        throw new Error(`Integration "${typeKey}" provider "${provider.key}" requires field "${field.name}".`);
      }
      if (field.type === 'number' && !isEmpty && Number.isNaN(Number(value))) {
        throw new Error(`Integration "${typeKey}" provider "${provider.key}" field "${field.name}" must be a number.`);
      }
    }
  }
}

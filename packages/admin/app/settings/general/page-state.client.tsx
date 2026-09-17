import type { SetStateAction } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { TimezoneUtils } from '@/lib/timezone';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { TenantScopeClient } from '@/lib/tenants/tenant-scope-client';

/**
 * What the general settings screen knows: the values being edited, and which of them this scope may
 * change at all.
 *
 * The base of this page's chain — the load and save, then the lifecycle and markup.
 *
 * `platformLocks` is why a field can be present and refused: a value owned by the PLATFORM is shown
 * inside a site so the operator can see what applies, with a link to where it is actually set,
 * rather than offered as an editable field that silently fails.
 */
export abstract class GeneralSettingsPageState extends AdminComponent {
  /** The keys this screen owns. Was the key set of a seeded `@state settings` object — see `settings`. */
  protected static readonly TEXT_KEYS = [
    'platform_name',
    'notification_email',
    'notification_email_cc',
    'frontend_url',
    'admin_url',
    'site_url',
    'marketplace_url',
    'framework_repository',
    'sources_workspace_root',
    'timezone',
  ] as const;
  protected static readonly BOOLEAN_KEYS = [
    'admin_search_indexing',
    'email_notifications',
    'frontend_auth_enabled',
    'frontend_registration_enabled',
  ] as const;

  @state isSaving = false;
  @state isSendingTelemetryTest = false;
  @state isLoading = true;
  /**
   * `null` means NEVER LOADED — it is not an empty form.
   *
   * This used to be seeded with `timezone: 'UTC'`, `frontend_auth_enabled: true` and
   * `frontend_registration_enabled: true`. All three are DECLARED server-side
   * (`packages/api/src/server/server-settings-service.ts` seeds them into `_system_meta`), so the
   * copies here were a second, invisible default — and because the load had no `catch`, a failed
   * settings GET rendered "Frontend Registration: ON" as though an operator had enabled public
   * self-registration, and Save then persisted it. No seed now: a failed load shows `loadError` and
   * the Save control is not rendered.
   */
  @state settings: Record<string, any> | null = null;
  /**
   * Which of these settings belong to the PLATFORM and are out of this account's reach. Asked of the
   * server, never listed here — see {@link PlatformSettingLocks}. Nothing is locked until it answers.
   */
  @state platformLocks: PlatformSettingLocks = PlatformSettingLocks.none();
  @state loadError: string | null = null;

  protected get timezoneOptions(): { label: string; value: string }[] {
    return TimezoneUtils.getTimezoneOptions(String(this.settings?.timezone ?? '').trim());
  }

  @bound
  setSettings(update: SetStateAction<Record<string, any>>): void {
    const current = this.settings;
    if (!current) return;
    this.settings = typeof update === 'function'
      ? (update as (prev: Record<string, any>) => Record<string, any>)(current)
      : update;
  }

  protected get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  /**
   * Step out to the platform scope, so the settings this screen is not showing become reachable.
   *
   * Offered only to an account that may actually change them — for anyone else the notice says who
   * can, and a button that leads to a screen they cannot use is the dead control this page just
   * stopped rendering.
   */
  @bound
  async openPlatformScope(): Promise<void> {
    await TenantScopeClient.leaveAndReload();
  }
}

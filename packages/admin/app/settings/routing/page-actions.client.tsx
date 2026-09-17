import { NotificationType } from '@/components/enums/notification-type.enum';
import { bound } from '@fromcode119/react-class-components';
import { ContextBridge } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { RoutingPageResolution } from '@/app/settings/routing/page-resolution.client';

/**
 * Reading the routing settings and writing them back.
 */
export abstract class RoutingPageActions extends RoutingPageResolution {
  protected get registerSettings(): (settings: Record<string, any>) => void {
    const plugins = this.runtime?.plugins;
    if (plugins?.registerSettings) return plugins.registerSettings.bind(plugins);
    return ContextBridge.registerSettings.bind(ContextBridge);
  }

  protected async loadRouting(): Promise<void> {
    this.loadError = null;
    try {
      const [settingsResponse, frontendMeta, collectionStats] = await Promise.all([
        AdminSystemSettingsClient.getAll(),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.FRONTEND).catch(() => null),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.COLLECTIONS).catch(() => [])
      ]);

      // Read from the response ALONE — an absent key renders empty, it does not fall back to a literal.
      this.structure = String(settingsResponse?.permalink_structure ?? '');
      this.homeTarget = String(settingsResponse?.routing_home_target ?? '');
      this.frontendMeta = frontendMeta;
      this.availableCollections = Array.isArray(collectionStats) ? collectionStats : [];
    } catch (err: any) {
      this.structure = null;
      this.homeTarget = null;
      this.loadError = err?.message || 'The routing settings request failed.';
    } finally {
      this.isLoading = false;
    }
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadRouting();
  }

  @bound
  async handleSave(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    const structure = this.structure;
    const homeTarget = this.homeTarget;
    // Fail closed: never PUT values that were not read back from the server. The Save controls are not
    // rendered in this state.
    if (structure === null || homeTarget === null) return;
    this.isSaving = true;
    try {
      await AdminSystemSettingsClient.update({
        permalink_structure: structure,
        routing_home_target: homeTarget,
      });

      this.registerSettings({
        permalink_structure: structure,
        routing_home_target: homeTarget
      });

      addNotification({
        title: 'Routing Updated',
        message: 'Routing configuration has been synced.',
        type: NotificationType.SUCCESS
      });
    } catch (err: any) {
      addNotification({
        title: 'Update Failed',
        message: err?.message || 'Failed to save routing settings.',
        type: NotificationType.ERROR
      });
    } finally {
      this.isSaving = false;
    }
  }
}

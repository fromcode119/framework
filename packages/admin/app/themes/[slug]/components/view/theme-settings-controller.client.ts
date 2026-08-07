import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ThemeRecordHydrator } from '@/app/themes/[slug]/theme-record-hydrator';
import type { IThemeSettingsPageHost } from '@/app/themes/[slug]/interfaces/theme-settings-page-host.interface';

/**
 * Async data/action handlers for the theme settings page (fetch, activate, update, save config,
 * delete, run-seeds, reset), extracted from the former 1000-line page class. `page` is the
 * `ThemeSettingsPage`, reached through {@link IThemeSettingsPageHost} so this file never imports the
 * page class (which imports this one).
 */
export class ThemeSettingsController {
  static async fetchTheme(page: IThemeSettingsPageHost): Promise<void> {
    const slug = page.routeSlug;
    try {
      const [installedData, marketplaceData, configData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST),
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.CONFIG(slug)),
      ]);
      const found = installedData.find((row: { slug?: string }) => row.slug === slug);
      if (!found) {
        page.goToThemesList();
        return;
      }
      if (!page.mounted) return;
      const config = configData.config || {};
      // Hydrated at the FETCH BOUNDARY — the wire carries plain strings where `ITheme` declares enum
      // members. See ThemeRecordHydrator for what an un-hydrated row already broke in production.
      const theme = ThemeRecordHydrator.hydrate(found);
      page.themeDetail = theme;
      page.dbConfig = config;
      page.tempVariables = { ...(theme.variables || {}), ...(config.variables || {}) };
      page.tempLayouts = config.layouts || {};
      page.tempSettings = { ...(theme.settingsDefaults || {}), ...(config.settings || {}) };

      const marketplace = Array.isArray(marketplaceData) ? marketplaceData : (marketplaceData.themes || []);
      const marketMatch = marketplace.find((row: { slug?: string }) => row.slug === slug);
      if (marketMatch && page.mounted) page.marketplaceVersion = marketMatch.version;
    } catch (err) {
      console.error('Failed to fetch theme detail', err);
    } finally {
      if (page.mounted) page.loading = false;
    }
  }

  static async handleActivate(page: IThemeSettingsPageHost): Promise<void> {
    const themeDetail = page.themeDetail;
    if (!themeDetail) return;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.ACTIVATE(themeDetail.slug));
      page.notify(NotificationType.SUCCESS, 'Theme Activated', `${themeDetail.name} is now active.`);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, 'Activation Failed', err.message);
    }
  }

  static async handleUpdate(page: IThemeSettingsPageHost): Promise<void> {
    const themeDetail = page.themeDetail;
    if (!themeDetail) return;
    page.isUpdating = true;
    try {
      page.notify(NotificationType.INFO, 'Updating...', `Downloading latest version of ${themeDetail.slug}...`);
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.INSTALL(themeDetail.slug));
      page.notify(NotificationType.SUCCESS, 'Updated', `Theme ${themeDetail.name} has been updated.`);
      await ThemeSettingsController.fetchTheme(page);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, 'Update Failed', err.message);
    } finally {
      page.isUpdating = false;
    }
  }

  static async handleSaveConfig(page: IThemeSettingsPageHost): Promise<void> {
    const { themeDetail, routeSlug, dbConfig, tempVariables, tempLayouts, tempSettings } = page;
    if (!themeDetail) return;
    page.isSaving = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.CONFIG(routeSlug), {
        ...dbConfig,
        variables: tempVariables,
        layouts: tempLayouts,
        settings: tempSettings,
      });
      page.notify(NotificationType.SUCCESS, 'Configuration Saved', 'Visual protocols updated successfully.');
      await ThemeSettingsController.fetchTheme(page);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, 'Save Failed', err.message);
    } finally {
      page.isSaving = false;
    }
  }

  static async handleDelete(page: IThemeSettingsPageHost): Promise<void> {
    const themeDetail = page.themeDetail;
    if (!themeDetail) return;
    page.isDeleteConfirmOpen = false;
    page.isDeleting = true;
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.THEMES.DELETE(themeDetail.slug));
      page.notify(NotificationType.SUCCESS, 'Theme Deleted', `${themeDetail.name} has been removed.`);
      page.goToThemesList();
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, 'Deletion Failed', err.message);
    } finally {
      page.isDeleting = false;
    }
  }

  static async handleRunSeeds(page: IThemeSettingsPageHost): Promise<void> {
    const themeDetail = page.themeDetail;
    if (!themeDetail) return;
    page.isRunSeedsConfirmOpen = false;
    page.isReseeding = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.RESET(themeDetail.slug), { runSeeds: true, resetConfig: false });
      page.notify(NotificationType.SUCCESS, 'Seeds Executed', `Seed script executed for ${themeDetail.name}.`);
      await ThemeSettingsController.fetchTheme(page);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, 'Seed Failed', err.message);
    } finally {
      page.isReseeding = false;
    }
  }

  static async handleResetTheme(page: IThemeSettingsPageHost): Promise<void> {
    const themeDetail = page.themeDetail;
    if (!themeDetail) return;
    page.isResetThemeConfirmOpen = false;
    page.isResettingTheme = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.RESET(themeDetail.slug), { runSeeds: true, resetConfig: true });
      page.notify(NotificationType.SUCCESS, 'Theme Reset', `${themeDetail.name} config reset and seeds executed.`);
      await ThemeSettingsController.fetchTheme(page);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, 'Reset Failed', err.message);
    } finally {
      page.isResettingTheme = false;
    }
  }
}

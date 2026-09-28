import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ThemeRecordHydrator } from '@/app/themes/[slug]/theme-record-hydrator';
import type { IThemeSettingsPageHost } from '@/app/themes/[slug]/interfaces/theme-settings-page-host.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
      page.tempDefaultLayout = String(config.defaultLayout || '');
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
      page.notify(NotificationType.SUCCESS, AdminI18n.t('themes.themeActivated'), AdminI18n.t('themes.isNowActive', { name: themeDetail.name }));
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, AdminI18n.t('themes.activationFailed'), err.message);
    }
  }

  static async handleUpdate(page: IThemeSettingsPageHost): Promise<void> {
    const themeDetail = page.themeDetail;
    if (!themeDetail) return;
    page.isUpdating = true;
    try {
      page.notify(NotificationType.INFO, AdminI18n.t('themes.updating'), AdminI18n.t('themes.downloadingLatestVersionOf', { slug: themeDetail.slug }));
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.INSTALL(themeDetail.slug));
      page.notify(NotificationType.SUCCESS, AdminI18n.t('themes.updated'), AdminI18n.t('themes.themeHasBeenUpdated2', { name: themeDetail.name }));
      await ThemeSettingsController.fetchTheme(page);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, AdminI18n.t('themes.updateFailed'), err.message);
    } finally {
      page.isUpdating = false;
    }
  }

  static async handleSaveConfig(page: IThemeSettingsPageHost): Promise<void> {
    const { themeDetail, routeSlug, dbConfig, tempVariables, tempDefaultLayout, tempSettings } = page;
    if (!themeDetail) return;
    page.isSaving = true;
    try {
      // `layouts` was a core-layout → theme-layout map nothing ever read; the API no longer accepts it,
      // so a row that still carries one drops it on its next save.
      const { layouts: _retiredLayoutMap, ...storedConfig } = dbConfig;
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.CONFIG(routeSlug), {
        ...storedConfig,
        variables: tempVariables,
        defaultLayout: tempDefaultLayout,
        settings: tempSettings,
      });
      page.notify(NotificationType.SUCCESS, AdminI18n.t('themes.configurationSaved'), AdminI18n.t('themes.visualProtocolsUpdatedSuccessfully'));
      await ThemeSettingsController.fetchTheme(page);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, AdminI18n.t('themes.saveFailed'), err.message);
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
      page.notify(NotificationType.SUCCESS, AdminI18n.t('themes.themeDeleted'), AdminI18n.t('themes.hasBeenRemoved2', { name: themeDetail.name }));
      page.goToThemesList();
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, AdminI18n.t('themes.deletionFailed'), err.message);
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
      page.notify(NotificationType.SUCCESS, AdminI18n.t('themes.seedsExecuted'), AdminI18n.t('themes.seedScriptExecutedFor', { name: themeDetail.name }));
      await ThemeSettingsController.fetchTheme(page);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, AdminI18n.t('themes.seedFailed'), err.message);
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
      page.notify(NotificationType.SUCCESS, AdminI18n.t('themes.themeReset'), AdminI18n.t('themes.configResetAndSeedsExecuted', { name: themeDetail.name }));
      await ThemeSettingsController.fetchTheme(page);
      page.triggerRefresh();
    } catch (err: any) {
      page.notify(NotificationType.ERROR, AdminI18n.t('themes.resetFailed'), err.message);
    } finally {
      page.isResettingTheme = false;
    }
  }
}

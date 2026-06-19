"use client";

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';

/**
 * Async data/action handlers for the theme settings page (fetch, activate, update, save config,
 * delete, run-seeds, reset), extracted from the former 1000-line page class. `page` is the
 * `ThemeSettingsPage` instance, typed loosely to avoid a circular import.
 */
export class ThemeSettingsController {
  static async fetchTheme(page: any): Promise<void> {
    const slug = page.state.routeSlug;
    try {
      const [installedData, marketplaceData, configData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST),
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.CONFIG(slug))
      ]);
      const found = installedData.find((t: any) => t.slug === slug);
      if (found) {
        if (!page.mounted) return;
        page.setState({
          themeDetail: found,
          dbConfig: configData.config || {},
          tempVariables: { ...(found.variables || {}), ...(configData.config?.variables || {}) },
          tempLayouts: configData.config?.layouts || {},
          tempSettings: { ...(found.settingsDefaults || {}), ...(configData.config?.settings || {}) }
        });
        const marketplace = Array.isArray(marketplaceData) ? marketplaceData : (marketplaceData.themes || []);
        const marketMatch = marketplace.find((r: any) => r.slug === slug);
        if (marketMatch && page.mounted) page.setState({ marketplaceVersion: marketMatch.version });
      } else {
        page.router.push('/themes');
      }
    } catch (err) {
      console.error('Failed to fetch theme detail', err);
    } finally {
      if (page.mounted) page.setState({ loading: false });
    }
  }

  static async handleActivate(page: any): Promise<void> {
    const { themeDetail } = page.state;
    if (!themeDetail) return;
    const notify = page.runtime.notify.notify;
    const triggerRefresh = page.runtime.plugins?.triggerRefresh;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.ACTIVATE(themeDetail.slug));
      notify('success', 'Theme Activated', `${themeDetail.name} is now active.`);
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Activation Failed', err.message);
    }
  }

  static async handleUpdate(page: any): Promise<void> {
    const { themeDetail } = page.state;
    if (!themeDetail) return;
    const notify = page.runtime.notify.notify;
    const triggerRefresh = page.runtime.plugins?.triggerRefresh;
    page.setState({ isUpdating: true });
    try {
      notify('info', 'Updating...', `Downloading latest version of ${themeDetail.slug}...`);
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.INSTALL(themeDetail.slug));
      notify('success', 'Updated', `Theme ${themeDetail.name} has been updated.`);
      await ThemeSettingsController.fetchTheme(page);
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Update Failed', err.message);
    } finally {
      page.setState({ isUpdating: false });
    }
  }

  static async handleSaveConfig(page: any): Promise<void> {
    const { themeDetail, routeSlug, dbConfig, tempVariables, tempLayouts, tempSettings } = page.state;
    if (!themeDetail) return;
    const notify = page.runtime.notify.notify;
    const triggerRefresh = page.runtime.plugins?.triggerRefresh;
    page.setState({ isSaving: true });
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.CONFIG(routeSlug), { ...dbConfig, variables: tempVariables, layouts: tempLayouts, settings: tempSettings });
      notify('success', 'Configuration Saved', 'Visual protocols updated successfully.');
      await ThemeSettingsController.fetchTheme(page);
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Save Failed', err.message);
    } finally {
      page.setState({ isSaving: false });
    }
  }

  static async handleDelete(page: any): Promise<void> {
    const { themeDetail } = page.state;
    if (!themeDetail) return;
    const notify = page.runtime.notify.notify;
    const triggerRefresh = page.runtime.plugins?.triggerRefresh;
    page.setState({ isDeleting: true, isDeleteConfirmOpen: false });
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.THEMES.DELETE(themeDetail.slug));
      notify('success', 'Theme Deleted', `${themeDetail.name} has been removed.`);
      page.router.push('/themes');
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Deletion Failed', err.message);
    } finally {
      page.setState({ isDeleting: false });
    }
  }

  static async handleRunSeeds(page: any): Promise<void> {
    const { themeDetail } = page.state;
    if (!themeDetail) return;
    const notify = page.runtime.notify.notify;
    const triggerRefresh = page.runtime.plugins?.triggerRefresh;
    page.setState({ isRunSeedsConfirmOpen: false, isReseeding: true });
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.RESET(themeDetail.slug), { runSeeds: true, resetConfig: false });
      notify('success', 'Seeds Executed', `Seed script executed for ${themeDetail.name}.`);
      await ThemeSettingsController.fetchTheme(page);
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Seed Failed', err.message);
    } finally {
      page.setState({ isReseeding: false });
    }
  }

  static async handleResetTheme(page: any): Promise<void> {
    const { themeDetail } = page.state;
    if (!themeDetail) return;
    const notify = page.runtime.notify.notify;
    const triggerRefresh = page.runtime.plugins?.triggerRefresh;
    page.setState({ isResetThemeConfirmOpen: false, isResettingTheme: true });
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.RESET(themeDetail.slug), { runSeeds: true, resetConfig: true });
      notify('success', 'Theme Reset', `${themeDetail.name} config reset and seeds executed.`);
      await ThemeSettingsController.fetchTheme(page);
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Reset Failed', err.message);
    } finally {
      page.setState({ isResettingTheme: false });
    }
  }
}

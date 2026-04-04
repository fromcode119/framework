import { BrowserStateClient, ClientRuntimeConstants } from '@fromcode119/core/client';
import { BaseService } from './base-service';

export class UiPreferenceService extends BaseService {
  private static readonly THEME_KEY = 'theme';
  private static readonly SIDEBAR_OPEN_KEY = ClientRuntimeConstants.ADMIN_UI.STORAGE_KEYS.SIDEBAR_OPEN;
  private static readonly SIDEBAR_MINI_KEY = ClientRuntimeConstants.ADMIN_UI.STORAGE_KEYS.SIDEBAR_MINI;
  private static readonly SECONDARY_SIDEBAR_DESKTOP_OPEN_KEY = 'admin.ui.secondary-sidebar.desktop-open';
  private static readonly ADVANCED_MODE_KEY = ClientRuntimeConstants.ADMIN_UI.STORAGE_KEYS.ADVANCED_MODE;
  private static readonly COLLAPSED_GROUPS_KEY = ClientRuntimeConstants.ADMIN_UI.STORAGE_KEYS.COLLAPSED_GROUPS;

  private readonly browserState = new BrowserStateClient();

  readThemePreference(): string {
    return this.browserState.readLocalString(UiPreferenceService.THEME_KEY);
  }

  writeThemePreference(theme: string): void {
    this.browserState.writeLocalString(UiPreferenceService.THEME_KEY, String(theme || '').trim());
  }

  readSidebarOpen(): boolean | null {
    const value = this.browserState.readLocalString(UiPreferenceService.SIDEBAR_OPEN_KEY);
    if (!value) {
      return null;
    }

    return value === 'true';
  }

  writeSidebarOpen(isOpen: boolean): void {
    this.browserState.writeLocalString(UiPreferenceService.SIDEBAR_OPEN_KEY, String(Boolean(isOpen)));
  }

  readSidebarMini(): boolean {
    return this.browserState.readLocalString(UiPreferenceService.SIDEBAR_MINI_KEY) === 'true';
  }

  writeSidebarMini(isMini: boolean): void {
    this.browserState.writeLocalString(UiPreferenceService.SIDEBAR_MINI_KEY, String(Boolean(isMini)));
  }

  readSecondarySidebarDesktopOpen(): boolean | null {
    const value = this.browserState.readLocalString(UiPreferenceService.SECONDARY_SIDEBAR_DESKTOP_OPEN_KEY);
    if (!value) {
      return null;
    }

    return value === 'true';
  }

  writeSecondarySidebarDesktopOpen(isOpen: boolean): void {
    this.browserState.writeLocalString(UiPreferenceService.SECONDARY_SIDEBAR_DESKTOP_OPEN_KEY, String(Boolean(isOpen)));
  }

  readAdvancedMode(): boolean {
    return this.browserState.readLocalString(UiPreferenceService.ADVANCED_MODE_KEY) === 'true';
  }

  writeAdvancedMode(enabled: boolean): void {
    this.browserState.writeLocalString(UiPreferenceService.ADVANCED_MODE_KEY, String(Boolean(enabled)));
  }

  readCollapsedSidebarGroups(): string[] {
    return this.browserState.readLocalJson<string[]>(UiPreferenceService.COLLAPSED_GROUPS_KEY, []);
  }

  writeCollapsedSidebarGroups(groups: string[]): void {
    this.browserState.writeLocalJson(UiPreferenceService.COLLAPSED_GROUPS_KEY, Array.isArray(groups) ? groups : []);
  }

  readNavExpanded(persistenceKey: string): boolean | null {
    const storageKey = this.buildNavExpandedStorageKey(persistenceKey);
    if (!storageKey) {
      return null;
    }

    const value = this.browserState.readLocalString(storageKey);
    if (!value) {
      return null;
    }

    return value === 'true';
  }

  writeNavExpanded(persistenceKey: string, expanded: boolean): void {
    const storageKey = this.buildNavExpandedStorageKey(persistenceKey);
    if (!storageKey) {
      return;
    }

    this.browserState.writeLocalString(storageKey, String(Boolean(expanded)));
  }

  readCollectionColumns(pluginSlug: string, collectionSlug: string): string[] {
    return this.browserState.readLocalJson<string[]>(
      this.buildCollectionColumnsStorageKey(pluginSlug, collectionSlug),
      [],
    );
  }

  writeCollectionColumns(pluginSlug: string, collectionSlug: string, columnIds: string[]): void {
    this.browserState.writeLocalJson(
      this.buildCollectionColumnsStorageKey(pluginSlug, collectionSlug),
      Array.isArray(columnIds) ? columnIds : [],
    );
  }

  private buildNavExpandedStorageKey(persistenceKey: string): string {
    const normalizedKey = String(persistenceKey || '').trim();
    return normalizedKey ? `${ClientRuntimeConstants.ADMIN_UI.STORAGE_PREFIXES.NAV_EXPANDED}${normalizedKey}` : '';
  }

  private buildCollectionColumnsStorageKey(pluginSlug: string, collectionSlug: string): string {
    return `${ClientRuntimeConstants.ADMIN_UI.STORAGE_PREFIXES.COLLECTION_COLUMNS}${String(pluginSlug || '').trim()}_${String(collectionSlug || '').trim()}`;
  }
}

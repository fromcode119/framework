import type { ThemeMode } from '@fromcode119/core/client';
import type { ThemeSettingsTab } from '@/app/themes/[slug]/enums/theme-settings-tab.enum';

/**
 * The slice of `ThemeSettingsPage` its VIEW components read: the `@state` fields they render plus the
 * handlers they call. Declared here — not imported from the page class — so `page → view → page` never
 * becomes an import cycle, which is what the `@prop declare page: any` on every view was avoiding.
 *
 * That `any` was not free. `{themeDetail.state}` handed a `ThemeState` Enum INSTANCE to React as a
 * child and threw "Minified React error #31 — object with keys {value}", blanking the whole page.
 * Against a real type, `ReactNode` rejects that at compile time (verified: `tsc` reports
 * `Type 'ThemeState' is not assignable to type 'ReactNode'`).
 *
 * Members are `readonly` here because a view only READS page state — mutation belongs to the page's own
 * handlers and to `IThemeSettingsPageHost`, which the controller drives.
 */
export interface IThemeSettingsPageView {
  /** Admin light/dark mode. Named apart from `AdminComponent.theme`, which is `protected`. */
  readonly adminTheme: ThemeMode;
  /** Platform settings published by the plugins runtime; the live-preview URL resolves against them. */
  readonly pluginSettings: Record<string, unknown> | null;

  readonly marketplaceVersion: string | null;
  readonly activeTab: ThemeSettingsTab;
  /** Edited theme variables, keyed by variable name. Values are always strings (colors, fonts, sizes). */
  readonly tempVariables: Record<string, string>;
  /** Edited layout mapping: core layout id → the theme layout `name` bound to it. */
  readonly tempLayouts: Record<string, string>;
  /** Edited theme settings. Free-form by design (a theme declares its own), hence `unknown` values. */
  readonly tempSettings: Record<string, unknown>;

  readonly isUpdating: boolean;
  readonly isSaving: boolean;
  readonly isReseeding: boolean;
  readonly isResettingTheme: boolean;
  readonly isDeleting: boolean;
  readonly isDeleteConfirmOpen: boolean;
  readonly isRunSeedsConfirmOpen: boolean;
  readonly isResetThemeConfirmOpen: boolean;

  handleActivate(): Promise<void>;
  handleUpdate(): Promise<void>;
  handleSaveConfig(): Promise<void>;
  handleDelete(): Promise<void>;
  handleRunSeeds(): Promise<void>;
  handleResetTheme(): Promise<void>;

  openDeleteConfirm(): void;
  openRunSeedsConfirm(): void;
  openResetThemeConfirm(): void;
  closeDeleteConfirm(): void;
  closeRunSeedsConfirm(): void;
  closeResetThemeConfirm(): void;

  handleVariableChange(key: string, value: string): void;
  handleLayoutChange(key: string, value: string): void;
  handleSettingChange(key: string, value: unknown): void;
}

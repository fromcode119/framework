import type { NotificationType } from '@/components/enums/notification-type.enum';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';

/**
 * What `ThemeSettingsController` needs to drive `ThemeSettingsPage` — the async fetch/action half,
 * kept separate from the read-only `IThemeSettingsPageView` the render components consume. Declared
 * here rather than importing the page class so the controller stays out of an import cycle.
 *
 * The mutable fields are `@state` fields on the page: assigning one re-renders (reactor's `@state`
 * accessor routes the write through `setState` and shadows it until React commits), so the controller
 * assigns them directly instead of hand-rolling `setState` payloads.
 *
 * The page owns everything the controller cannot reach: `notify`, `triggerRefresh` and
 * `goToThemesList` wrap `AdminComponent`'s PROTECTED `runtime`/`router`, so the controller never
 * reaches through the component's internals to get at them.
 */
export interface IThemeSettingsPageHost {
  /** True between `componentDidMount` and `componentWillUnmount` — guards writes after unmount. */
  readonly mounted: boolean;
  /** Theme slug resolved from the route params. */
  readonly routeSlug: string;

  /** Raise an admin notification. Wraps the page's protected runtime notification context. */
  notify(type: NotificationType, title: string, message: string): void;
  /** Ask the plugins runtime to re-read plugin/theme metadata. */
  triggerRefresh(): void;
  /** Navigate back to the themes list (after a delete, or when the slug matches no installed theme). */
  goToThemesList(): void;

  themeDetail: ITheme | null;
  marketplaceVersion: string | null;
  loading: boolean;
  /** The theme's saved config row, as stored. Free-form by design, hence `unknown` values. */
  dbConfig: Record<string, unknown>;
  tempVariables: Record<string, string>;
  tempLayouts: Record<string, string>;
  tempSettings: Record<string, unknown>;

  isUpdating: boolean;
  isSaving: boolean;
  isReseeding: boolean;
  isResettingTheme: boolean;
  isDeleting: boolean;
  isDeleteConfirmOpen: boolean;
  isRunSeedsConfirmOpen: boolean;
  isResetThemeConfirmOpen: boolean;
}

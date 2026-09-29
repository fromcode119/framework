/**
 * A widget a plugin offers to the admin dashboard, declared in `manifest.json` → `admin.widgets[]`.
 *
 * The component lives in the plugin's admin bundle and registers under the slot
 * `admin.dashboard.widget.<plugin-slug>.<id>`; the dashboard renders exactly that slot. Every operator
 * then decides for themselves whether the widget is on their dashboard, where, and how wide.
 *
 * `label` and `description` are English; `admin.widgets.<id>.label|description` in the plugin's
 * dictionary translates them, like every other piece of plugin admin text.
 */
export interface IDashboardWidgetManifest {
  /** Unique within the plugin; part of the slot name and of every saved layout. */
  id: string;
  label: string;
  description?: string;
  /** `small` | `medium` | `large` — one, two or three columns. The operator can change it. */
  size?: string;
  /** Shown on a dashboard that has no saved layout yet. An operator can add a widget either way. */
  defaultVisible?: boolean;
  /**
   * The permission a person needs to be offered this widget (`<plugin>:manage`, say) — the one the
   * screen it summarises asks for, so a widget never shows what its reader could not open. None means
   * administrators only, as for menu items.
   */
  permission?: string;
}

import { DashboardWidgetSize } from '@fromcode119/core/client';
import { Slot } from '@fromcode119/react';
import { PermissionGrants } from '@fromcode119/core/utils/permission-grants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';

/**
 * The widgets active plugins declare in `manifest.json` → `admin.widgets[]` (already in the reader's
 * language — the api localizes them with the rest of the plugin's admin text).
 *
 * Each renders the slot `admin.dashboard.widget.<plugin>.<id>`, which the plugin's admin bundle fills.
 * Until the bundles have loaded the slot is empty; after that, an empty slot means the plugin declared a
 * widget its bundle does not provide, and the card says so instead of standing blank.
 */
export class DashboardPluginWidgets {
  static slotName(pluginSlug: string, widgetId: string): string {
    return `admin.dashboard.widget.${pluginSlug}.${widgetId}`;
  }

  static definitions(plugins: any[], bundlesLoaded: boolean, user: any): IDashboardWidgetDefinition[] {
    return (Array.isArray(plugins) ? plugins : []).flatMap((plugin) => {
      const widgets: any[] = Array.isArray(plugin?.admin?.widgets) ? plugin.admin.widgets : [];
      const slug = String(plugin?.slug || '');
      return widgets.filter((widget) => slug && widget?.id && DashboardPluginWidgets.permitted(widget, user)).map((widget): IDashboardWidgetDefinition => ({
        key: `plugin.${slug}.${widget.id}`,
        label: String(widget.label || widget.id),
        description: String(widget.description || ''),
        source: String(plugin?.admin?.label || plugin?.name || slug),
        size: DashboardWidgetSize.resolve(widget.size),
        defaultVisible: widget.defaultVisible !== false,
        render: () => (
          <Slot
            name={DashboardPluginWidgets.slotName(slug, String(widget.id))}
            fallback={DashboardPluginWidgets.placeholder(bundlesLoaded)}
          />
        ),
      }));
    });
  }

  /** The menu's rule: administrators see every widget; anyone else needs the one it names (or a wildcard). */
  private static permitted(widget: any, user: any): boolean {
    if (user?.roles?.includes('admin')) return true;
    const required = String(widget?.permission || '').trim();
    const granted: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    return Boolean(required) && PermissionGrants.covers(granted, required);
  }

  private static placeholder(bundlesLoaded: boolean) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-400 dark:border-slate-800">
        {AdminI18n.t(bundlesLoaded ? 'dashboard.widgets.unavailable' : 'dashboard.widgets.loading')}
      </div>
    );
  }
}

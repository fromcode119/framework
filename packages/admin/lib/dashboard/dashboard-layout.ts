import { DashboardWidgetSize } from '@fromcode119/core/client';
import type { IDashboardLayoutEntry } from '@/lib/dashboard/interfaces/dashboard-layout-entry.interface';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';

/**
 * A person's dashboard: which widgets, in what order, how wide. Pure — the board owns state and saving.
 *
 * A saved layout names widgets by key. A widget whose plugin is gone (disabled, uninstalled, not run on
 * this site) is simply not shown and drops out on the next save; a widget added since the layout was
 * saved is NOT forced onto it — the person chose their dashboard, and the new one waits in "Add widget".
 */
export class DashboardLayout {
  /** The widgets to show, from the saved layout, or the defaults when nothing is saved. */
  static resolve(definitions: IDashboardWidgetDefinition[], saved: IDashboardLayoutEntry[] | null): IDashboardLayoutEntry[] {
    if (!Array.isArray(saved)) return DashboardLayout.defaults(definitions);
    const known = new Set(definitions.map((definition) => definition.key));
    const seen = new Set<string>();
    return saved
      .filter((entry) => known.has(entry?.key) && !seen.has(entry.key) && seen.add(entry.key))
      .map((entry) => ({ key: entry.key, size: DashboardWidgetSize.resolve(entry.size).value }));
  }

  static defaults(definitions: IDashboardWidgetDefinition[]): IDashboardLayoutEntry[] {
    return definitions
      .filter((definition) => definition.defaultVisible)
      .map((definition) => ({ key: definition.key, size: definition.size.value }));
  }

  /** Widgets the person can still add — everything offered that is not on their dashboard. */
  static available(definitions: IDashboardWidgetDefinition[], layout: IDashboardLayoutEntry[]): IDashboardWidgetDefinition[] {
    const shown = new Set(layout.map((entry) => entry.key));
    return definitions.filter((definition) => !shown.has(definition.key));
  }

  static add(layout: IDashboardLayoutEntry[], definition: IDashboardWidgetDefinition): IDashboardLayoutEntry[] {
    if (layout.some((entry) => entry.key === definition.key)) return layout;
    return [...layout, { key: definition.key, size: definition.size.value }];
  }

  static remove(layout: IDashboardLayoutEntry[], key: string): IDashboardLayoutEntry[] {
    return layout.filter((entry) => entry.key !== key);
  }

  static resize(layout: IDashboardLayoutEntry[], key: string, size: DashboardWidgetSize): IDashboardLayoutEntry[] {
    return layout.map((entry) => (entry.key === key ? { ...entry, size: size.value } : entry));
  }

  /** Moves the widget `key` to where `target` is (dropping onto a widget puts it in that widget's place). */
  static move(layout: IDashboardLayoutEntry[], key: string, target: string): IDashboardLayoutEntry[] {
    const from = layout.findIndex((entry) => entry.key === key);
    const to = layout.findIndex((entry) => entry.key === target);
    if (from < 0 || to < 0 || from === to) return layout;
    const next = [...layout];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    return next;
  }

  /** One step earlier (-1) or later (+1) — the keyboard- and touch-friendly twin of dragging. */
  static shift(layout: IDashboardLayoutEntry[], key: string, step: number): IDashboardLayoutEntry[] {
    const from = layout.findIndex((entry) => entry.key === key);
    const neighbour = layout[from + step];
    return from < 0 || !neighbour ? layout : DashboardLayout.move(layout, key, neighbour.key);
  }
}

import type { ReactNode } from 'react';
import { AccountSection } from '@react/account/account-section';
import { AccountOverviewPanel } from '@react/account/overview-panel';
import { AccountProfilePanel } from '@react/account/profile-panel';
import { AccountSecurityPanel } from '@react/account/security-panel';
import { AccountSessionsPanel } from '@react/account/sessions-panel';
import { AccountTwoFactorPanel } from '@react/account/two-factor-panel';
import { AccountEmailPreferencesPanel } from '@react/account/email-preferences-panel';
import { AccountFilesPanel } from '@react/account/files-panel';
import { AccountPushNotificationsPanel } from '@react/account/push-notifications-panel';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import { PluginUsageTracker } from '@react/plugin-usage-tracker';

/**
 * Turns the panels registered in the `account.panels` slot into the ordered section list.
 *
 * This is the ONLY place the account area learns what sections exist. The framework names no plugin: a
 * section exists because some panel declared `static accountSection = { key, labelKey, priority }`, so
 * domain sections arrive from the plugins that own them and vanish with them.
 * Both the shell (nav + active panel) and the overview (quick links) read the list from here, so they can
 * never disagree about what the account contains.
 */
export class AccountSectionRegistry {
  /**
   * The panels the FRAMEWORK itself owns — overview, profile, security, sessions, two-factor.
   *
   * They live here rather than inside the default shell so that a theme which REPLACES the shell still
   * gets them: the `account.shell` override swaps the layout, not the account's core features. A replacement
   * calls {@link AccountSectionRegistry.buildAll} and inherits the same complete section list.
   */
  private static readonly BUILTIN = [
    { component: AccountOverviewPanel, pluginSlug: 'framework' },
    { component: AccountProfilePanel, pluginSlug: 'framework' },
    { component: AccountSecurityPanel, pluginSlug: 'framework' },
    { component: AccountSessionsPanel, pluginSlug: 'framework' },
    { component: AccountTwoFactorPanel, pluginSlug: 'framework' },
    { component: AccountEmailPreferencesPanel, pluginSlug: 'framework' },
    // Appending is safe: sections sort by priority then key, never by position in this array.
    { component: AccountFilesPanel, pluginSlug: 'framework' },
    { component: AccountPushNotificationsPanel, pluginSlug: 'framework' },
  ] as unknown as ISlotComponent[];

  /** Framework panels + everything registered in the `account.panels` slot. The complete account. */
  static buildAll(slotPanels: ISlotComponent[] | undefined, globalSettings?: Record<string, unknown>): AccountSection[] {
    // The panels are read straight from the slot — no `<Slot>` renders them — so this is where their
    // plugins are reported as used. Unreported, the page marked those bundles idle, the browser deferred
    // them past hydration, and its first render listed fewer sections than the server had: a mismatch
    // that re-rendered the whole account client-side.
    (slotPanels || []).forEach((panel) => PluginUsageTracker.record(panel?.pluginSlug));
    return AccountSectionRegistry.build([...AccountSectionRegistry.BUILTIN, ...(slotPanels || [])], globalSettings);
  }

  /**
   * A panel may declare `offeredWhen(globalSettings)`: when it answers false the shop has switched the
   * feature off in its own settings, and the section is left out of the menu instead of opening onto a
   * "not offered" page. The panel's plugin owns the question; the shell only asks it.
   */
  static build(panels: ISlotComponent[], globalSettings: Record<string, unknown> = {}): AccountSection[] {
    const byKey = new Map<string, AccountSection>();
    const merged: Array<{ into: string; alias: string; item: ISlotComponent; priority: number; icon?: ReactNode }> = [];
    panels.forEach((item, index) => {
      const entry = item as ISlotComponent | null;
      const meta = ((entry?.component as { accountSection?: Record<string, unknown> } | undefined)?.accountSection) || {};
      const offeredWhen = meta.offeredWhen as ((settings: Record<string, unknown>) => boolean) | undefined;
      if (offeredWhen && !offeredWhen(globalSettings)) return;
      const key = String(meta.key || entry?.pluginSlug || `section-${index}`).toLowerCase();
      const labelKey = String(meta.labelKey || meta.label || meta.key || entry?.pluginSlug || key);
      const priority = typeof meta.priority === 'number' ? meta.priority : 100;
      const icon = meta.icon as ReactNode | undefined;
      const descriptionKey = meta.descriptionKey ? String(meta.descriptionKey) : undefined;
      const group = meta.group ? String(meta.group).toLowerCase() : undefined;
      const groupLabelKey = meta.groupLabelKey ? String(meta.groupLabelKey) : undefined;
      const into = meta.mergeInto ? String(meta.mergeInto).toLowerCase() : '';
      if (into && into !== key) {
        merged.push({ into, alias: key, item, priority, icon });
        return;
      }
      const existing = byKey.get(key);
      if (existing) {
        existing.absorb(item, priority, icon);
        existing.assignGroup(group, groupLabelKey);
      } else byKey.set(key, AccountSection.from(key, labelKey, priority, item, icon, descriptionKey, group, groupLabelKey));
    });
    // Folded after every section exists, so a merge does not depend on registration order. A merge
    // whose target is not installed keeps the panel reachable as a section of its own.
    merged.forEach(({ into, alias, item, priority, icon }) => {
      const target = byKey.get(into);
      if (target) {
        target.items.push(item);
        target.aliases.push(alias);
      } else if (byKey.has(alias)) byKey.get(alias)!.absorb(item, priority, icon);
      else byKey.set(alias, AccountSection.from(alias, alias, priority, item, icon));
    });
    return [...byKey.values()].sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  }

  /** The section a URL key opens — by its own key or an alias merged into it. */
  static resolve(sections: AccountSection[], key: string): AccountSection | undefined {
    return sections.find((s) => s.answers(key));
  }

  /**
   * The nav's grouping: ungrouped sections first, then each group in the order of its earliest
   * section. Derived from the sections alone, so a replacement shell gets the same grouping.
   */
  static groups(sections: AccountSection[]): Array<{ key: string; labelKey: string; sections: AccountSection[] }> {
    const out: Array<{ key: string; labelKey: string; sections: AccountSection[] }> = [];
    sections.forEach((section) => {
      const bucket = out.find((g) => g.key === section.group);
      if (bucket) bucket.sections.push(section);
      else out.push({ key: section.group, labelKey: section.groupLabelKey, sections: [section] });
    });
    return out.sort((a, b) => Number(Boolean(a.key)) - Number(Boolean(b.key)));
  }
}

import type { ReactNode } from 'react';
import { AccountSection } from '@react/account/account-section';
import { AccountOverviewPanel } from '@react/account/overview-panel';
import { AccountProfilePanel } from '@react/account/profile-panel';
import { AccountSecurityPanel } from '@react/account/security-panel';
import { AccountSessionsPanel } from '@react/account/sessions-panel';
import { AccountTwoFactorPanel } from '@react/account/two-factor-panel';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';

/**
 * Turns the panels registered in the `account.panels` slot into the ordered section list.
 *
 * This is the ONLY place the account area learns what sections exist. The framework names no plugin: a
 * section exists because some panel declared `static accountSection = { key, labelKey, priority }`, so
 * orders/courses/subscription/affiliate arrive from ecommerce/lms/subscriptions/mlm and vanish with them.
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
  ] as unknown as ISlotComponent[];

  /** Framework panels + everything registered in the `account.panels` slot. The complete account. */
  static buildAll(slotPanels: ISlotComponent[] | undefined): AccountSection[] {
    return AccountSectionRegistry.build([...AccountSectionRegistry.BUILTIN, ...(slotPanels || [])]);
  }

  static build(panels: ISlotComponent[]): AccountSection[] {
    const byKey = new Map<string, AccountSection>();
    panels.forEach((item, index) => {
      const entry = item as ISlotComponent | null;
      const meta = ((entry?.component as { accountSection?: Record<string, unknown> } | undefined)?.accountSection) || {};
      const key = String(meta.key || entry?.pluginSlug || `section-${index}`).toLowerCase();
      const labelKey = String(meta.labelKey || meta.label || meta.key || entry?.pluginSlug || key);
      const priority = typeof meta.priority === 'number' ? meta.priority : 100;
      const icon = meta.icon as ReactNode | undefined;
      const descriptionKey = meta.descriptionKey ? String(meta.descriptionKey) : undefined;
      const existing = byKey.get(key);
      if (existing) existing.absorb(item, priority, icon);
      else byKey.set(key, AccountSection.from(key, labelKey, priority, item, icon, descriptionKey));
    });
    return [...byKey.values()].sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  }
}

import type { ReactNode } from 'react';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';

/**
 * One section of the account area, as derived from a registered panel's static `accountSection`
 * descriptor (`{ key, labelKey, priority }`).
 *
 * Several panels may claim the same key — a plugin can extend a section the framework or another plugin
 * already owns — so a section carries the LIST of panels that render into it, in registration order.
 */
export class AccountSection {
  key = '';

  labelKey = '';

  priority = 100;

  /**
   * Translation key for the one-line description shown under the label on a dashboard tile.
   *
   * Baymard's Accounts & Self-Service benchmark: a tile needs an icon, a label AND secondary text —
   * the label alone leaves users guessing what "Downloads" or "Materials" contains. A panel declares it
   * as `descriptionKey` on its `accountSection` descriptor; sections without one fall back to
   * `<labelKey>.description`, and render no description if that is untranslated too.
   */
  descriptionKey = '';

  items: ISlotComponent[] = [];

  /**
   * Opaque id of the nav group this section sits under (`''` = ungrouped, listed first). A panel
   * declares it as `group` on its descriptor; sections from different owners that name the same id
   * share one heading. The heading's words come from `groupLabelKey` (default `account.group.<id>`).
   */
  group = '';

  groupLabelKey = '';

  /**
   * Other keys that lead here. A panel declaring `mergeInto: '<key>'` renders inside that section, and
   * its own key stays reachable as an alias so a bookmarked `/account/<old-key>` still opens it.
   */
  aliases: string[] = [];

  /** Bare SVG children supplied by the owning panel; the framework wraps them (AccountSectionIcons). */
  icon?: ReactNode;

  static from(key: string, labelKey: string, priority: number, item: ISlotComponent, icon?: ReactNode, descriptionKey?: string, group?: string, groupLabelKey?: string): AccountSection {
    const section = new AccountSection();
    section.key = key;
    section.labelKey = labelKey;
    section.priority = priority;
    section.items = [item];
    section.icon = icon;
    section.descriptionKey = descriptionKey || `${labelKey}.description`;
    section.assignGroup(group, groupLabelKey);
    return section;
  }

  /** Fold another panel into this section: it renders here too, and the earliest priority wins. */
  absorb(item: ISlotComponent, priority: number, icon?: ReactNode): void {
    this.items.push(item);
    this.priority = Math.min(this.priority, priority);
    // First panel to supply a glyph owns the section's icon; a later extender does not steal it.
    if (!this.icon) this.icon = icon;
  }

  /** The first owner to name a group decides it; a later extender does not move the section. */
  assignGroup(group?: string, groupLabelKey?: string): void {
    if (this.group || !group) return;
    this.group = group;
    this.groupLabelKey = groupLabelKey || `account.group.${group}`;
  }

  /** True when `key` opens this section — its own key or one merged into it. */
  answers(key: string): boolean {
    return this.key === key || this.aliases.includes(key);
  }
}

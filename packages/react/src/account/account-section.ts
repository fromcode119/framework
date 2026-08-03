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

  /** Bare SVG children supplied by the owning panel; the framework wraps them (AccountSectionIcons). */
  icon?: ReactNode;

  static from(key: string, labelKey: string, priority: number, item: ISlotComponent, icon?: ReactNode, descriptionKey?: string): AccountSection {
    const section = new AccountSection();
    section.key = key;
    section.labelKey = labelKey;
    section.priority = priority;
    section.items = [item];
    section.icon = icon;
    section.descriptionKey = descriptionKey || `${labelKey}.description`;
    return section;
  }

  /** Fold another panel into this section: it renders here too, and the earliest priority wins. */
  absorb(item: ISlotComponent, priority: number, icon?: ReactNode): void {
    this.items.push(item);
    this.priority = Math.min(this.priority, priority);
    // First panel to supply a glyph owns the section's icon; a later extender does not steal it.
    if (!this.icon) this.icon = icon;
  }
}

import type { ISettingsSection } from '@fromcode119/core/client';
import type { IPluginSettingsSectionCard } from '@/components/plugins/interfaces/plugin-settings-section-card.interface';


/**
 * How a settings tab's fields sort into cards: one per `admin.section` heading, in the order the headings
 * first appear, as a record's editor groups the same declaration. A field naming no section joins the
 * untitled card. The line under a heading is the schema's `sections` entry with the heading's key.
 */
export class PluginSettingsSections {
  static cardsOf(fields: any[], sections: ISettingsSection[] | undefined): IPluginSettingsSectionCard[] {
    const cards: IPluginSettingsSectionCard[] = [];
    const indexByKey = new Map<string, number>();
    for (const field of fields) {
      const title = typeof field?.admin?.section === 'string' ? field.admin.section.trim() : '';
      const key = title ? String(field.admin.sectionKey || title) : '';
      const existing = indexByKey.get(key);
      if (existing !== undefined) { cards[existing].fields.push(field); continue; }
      indexByKey.set(key, cards.length);
      const declared = key ? (sections || []).find((section) => section?.name === key) : undefined;
      cards.push({ key: key || '_untitled', title: title || undefined, description: declared?.description || undefined, fields: [field] });
    }
    return cards;
  }
}

import { StringUtils } from '@core/utils/string-utils';

/**
 * A plugin's admin text in the console's language, from that plugin's own dictionary.
 *
 * Collection names, field labels, settings labels and menu entries are declared in a plugin's schema,
 * in English. The console's language (Settings → Localization → "Admin default locale") never reached
 * them, so a Bulgarian console still showed every plugin screen in English. Each piece of text now has a
 * conventional key in the plugin's dictionary; a key the dictionary has replaces the literal, and a key
 * it lacks leaves the literal as it is — a plugin translates as much as it has translated, never less.
 *
 *   admin.label                                        the plugin's short name (nav dropdown)
 *   admin.groups.<group-slug>                          a nav group heading
 *   admin.menu.<last-path-segment>                     a menu entry that is not a collection list
 *                                                      (`overview` for the plugin's root path)
 *   admin.collections.<collection>.label               a collection's name (also its menu entry)
 *   admin.collections.<collection>.tabs.<name>         admin tabs / sections (`.sections.<name>.label|description`)
 *   admin.collections.<collection>.fields.<field>.label | description | placeholder
 *   admin.collections.<collection>.fields.<field>.options.<value>
 *   admin.collections.<collection>.fields.<field>.keyLabels.<key>        a structured field's key names
 *   admin.collections.<collection>.fields.<field>.fields.<sub-field>…   group / array sub-fields
 *   admin.collections.<collection>.sections.<heading-slug>.label         a field's `admin.section` heading
 *   admin.collections.<collection>.recordLinks.title | emptyHint        the related-records panel's words
 *   admin.settings.tabs.<id>, admin.settings.fields.<field>.…           the settings form, same shape
 *   admin.widgets.<id>.label | description                              a dashboard widget
 *
 * `lookup(pluginSlug, key)` answers the translation or '' — the caller binds it to one locale.
 */
export class AdminSchemaLocalizer {
  constructor(private readonly lookup: (pluginSlug: string, key: string) => string) {}

  collection<T extends Record<string, any>>(pluginSlug: string, collection: T): T {
    const base = `admin.collections.${AdminSchemaLocalizer.collectionKey(collection)}`;
    const admin = collection.admin ? {
      ...collection.admin,
      tabs: this.labelled(pluginSlug, `${base}.tabs`, collection.admin.tabs),
      sections: this.sections(pluginSlug, `${base}.sections`, collection.admin.sections),
      ...(collection.admin.recordLinks ? {
        recordLinks: {
          ...collection.admin.recordLinks,
          title: this.text(pluginSlug, `${base}.recordLinks.title`, collection.admin.recordLinks.title),
          emptyHint: this.text(pluginSlug, `${base}.recordLinks.emptyHint`, collection.admin.recordLinks.emptyHint),
        },
      } : {}),
    } : collection.admin;
    const adminLayout = collection.adminLayout ? {
      ...collection.adminLayout,
      tabs: this.labelled(pluginSlug, `${base}.tabs`, collection.adminLayout.tabs),
      sections: this.sections(pluginSlug, `${base}.sections`, collection.adminLayout.sections),
    } : collection.adminLayout;
    return {
      ...collection,
      displayName: this.text(pluginSlug, `${base}.label`, collection.displayName),
      fields: this.fields(pluginSlug, `${base}.fields`, collection.fields, `${base}.sections`),
      ...(admin ? { admin } : {}),
      ...(adminLayout ? { adminLayout } : {}),
    };
  }

  /** The name, description and category an operator reads in the plugin list — `admin.label`, `admin.description`, `admin.category`. */
  manifest<T extends Record<string, any>>(pluginSlug: string, manifest: T): T {
    return {
      ...manifest,
      name: this.text(pluginSlug, 'admin.label', manifest.name),
      description: this.text(pluginSlug, 'admin.description', manifest.description),
      category: this.text(pluginSlug, 'admin.category', manifest.category),
    };
  }

  settings<T extends Record<string, any>>(pluginSlug: string, schema: T): T {
    return {
      ...schema,
      tabs: Array.isArray(schema.tabs)
        ? schema.tabs.map((tab: any) => ({ ...tab, label: this.text(pluginSlug, `admin.settings.tabs.${tab?.id}`, tab?.label) }))
        : schema.tabs,
      fields: this.fields(pluginSlug, 'admin.settings.fields', schema.fields, 'admin.settings.sections'),
    };
  }

  /** The dashboard widgets a plugin declares — `admin.widgets.<id>.label|description`. */
  widgets(pluginSlug: string, widgets: any[] | undefined): any[] | undefined {
    if (!Array.isArray(widgets)) return widgets;
    return widgets.map((widget) => ({
      ...widget,
      label: this.text(pluginSlug, `admin.widgets.${widget?.id}.label`, widget?.label),
      description: this.text(pluginSlug, `admin.widgets.${widget?.id}.description`, widget?.description),
    }));
  }

  /** Menu entries and their groups; the framework's own entries (`pluginSlug: 'system'`) are the console's to translate. */
  menu(items: any[], adminLabelOf: (pluginSlug: string) => string): any[] {
    return (items || []).map((item) => {
      const slug = String(item?.pluginSlug || '');
      if (!slug || slug === 'system') return item;
      const next: Record<string, any> = { ...item };
      if (item.group) next.group = this.text(slug, `admin.groups.${StringUtils.slugify(item.group, '')}`, item.group);
      next.label = this.menuLabel(slug, item, adminLabelOf(slug));
      if (Array.isArray(item.children)) next.children = this.menu(item.children, adminLabelOf);
      return next;
    });
  }

  /**
   * The secondary panel's plugin entries (`admin.panel.<item id>.label | description`, else the menu or
   * collection key of its path) and their group headings. The framework's own entries are the console's.
   */
  panel<T extends Record<string, any>>(payload: T, systemPlugin: string): T {
    if (!payload || typeof payload !== 'object') return payload;
    const localizeItem = (item: any) => {
      const slug = String(item?.sourcePlugin || '');
      if (!slug || slug === systemPlugin) return item;
      const segment = String(item?.path || '').split('/').filter(Boolean).pop() || '';
      const byPath = segment
        ? (this.lookup(slug, `admin.menu.${segment === slug ? 'overview' : segment}`) || this.lookup(slug, `admin.collections.${segment}.label`))
        : '';
      return {
        ...item,
        label: this.lookup(slug, `admin.panel.${item.id}.label`) || byPath || item.label,
        description: this.text(slug, `admin.panel.${item.id}.description`, item.description),
        group: item.group ? this.text(slug, `admin.groups.${StringUtils.slugify(item.group, '')}`, item.group) : item.group,
      };
    };
    const itemsByContext: Record<string, any[]> = {};
    for (const [contextId, items] of Object.entries(payload.itemsByContext || {})) {
      itemsByContext[contextId] = (items as any[]).map(localizeItem);
    }
    return {
      ...payload,
      itemsByContext,
      globalItems: Array.isArray(payload.globalItems) ? payload.globalItems.map(localizeItem) : payload.globalItems,
    };
  }

  private menuLabel(pluginSlug: string, item: any, adminLabel: string): string {
    const label = String(item?.label ?? '');
    if (item?.isGroup || (adminLabel && label === adminLabel)) return this.text(pluginSlug, 'admin.label', label);
    const last = String(item?.path || '').split('/').filter(Boolean).pop() || '';
    if (!last) return label;
    // The plugin's own root (`/<slug>`) is its overview page.
    const segment = last === pluginSlug ? 'overview' : last;
    return this.lookup(pluginSlug, `admin.menu.${segment}`) || this.lookup(pluginSlug, `admin.collections.${segment}.label`) || label;
  }

  private fields(pluginSlug: string, base: string, fields: any[] | undefined, sectionsBase: string): any[] | undefined {
    if (!Array.isArray(fields)) return fields;
    return fields.map((field) => {
      const name = String(field?.name || '');
      if (!name) return field;
      // A field another plugin added (`extend`) speaks that plugin's words, from `admin.extendedFields`.
      const extender = field.extendedBy && field.extendedBy !== pluginSlug ? String(field.extendedBy) : '';
      if (extender) {
        const [translated] = this.fields(extender, 'admin.extendedFields', [{ ...field, extendedBy: undefined }], 'admin.extendedFields.sections') ?? [field];
        return { ...translated, extendedBy: extender };
      }
      const key = `${base}.${name}`;
      const next: Record<string, any> = {
        ...field,
        label: this.text(pluginSlug, `${key}.label`, field.label),
        placeholder: this.text(pluginSlug, `${key}.placeholder`, field.placeholder),
      };
      if (field.admin) {
        next.admin = {
          ...field.admin,
          description: this.text(pluginSlug, `${key}.description`, field.admin.description),
          // A relationship or tag field declares its placeholder here, not at the top level; it was left in
          // the schema's English ("Search products by name…") on a Bulgarian console.
          ...(field.admin.placeholder ? { placeholder: this.text(pluginSlug, `${key}.placeholder`, field.admin.placeholder) } : {}),
          // The editor groups fields under this heading; one translation per heading, shared by its fields.
          section: this.text(pluginSlug, `${sectionsBase}.${StringUtils.slugify(field.admin.section, '')}.label`, field.admin.section),
          ...(field.admin.fallback ? { fallback: this.fallback(pluginSlug, `${key}.emptyMeans`, field.admin.fallback) } : {}),
          ...(field.admin.keyLabels ? { keyLabels: this.keyLabels(pluginSlug, `${key}.keyLabels`, field.admin.keyLabels) } : {}),
        };
      }
      if (Array.isArray(field.options)) {
        next.options = field.options.map((option: any) => (option && typeof option === 'object'
          ? { ...option, label: this.text(pluginSlug, `${key}.options.${option.value}`, option.label) }
          : option));
      }
      if (Array.isArray(field.fields)) next.fields = this.fields(pluginSlug, `${key}.fields`, field.fields, sectionsBase);
      return next;
    });
  }

  /**
   * The column and row names a read-only structured field prints for its keys (`admin.keyLabels`), per key —
   * `keyLabels.<key>` — so a table in a Bulgarian console does not head its columns in English.
   */
  private keyLabels(pluginSlug: string, base: string, labels: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(labels).map(([name, label]) => [name, this.text(pluginSlug, `${base}.${name}`, label as string)]));
  }

  /**
   * What an empty field means, per rule — `emptyMeans.<settingKey>` — so the line the editor prints
   * under an empty box is in the console's language too.
   */
  private fallback(pluginSlug: string, base: string, rules: any): any {
    const translate = (rule: any) => (rule && typeof rule === 'object'
      ? { ...rule, emptyMeans: this.text(pluginSlug, `${base}.${rule.settingKey}`, rule.emptyMeans) }
      : rule);
    return Array.isArray(rules) ? rules.map(translate) : translate(rules);
  }

  private labelled(pluginSlug: string, base: string, entries: any[] | undefined): any[] | undefined {
    if (!Array.isArray(entries)) return entries;
    return entries.map((entry) => ({ ...entry, label: this.text(pluginSlug, `${base}.${entry?.name}`, entry?.label) }));
  }

  private sections(pluginSlug: string, base: string, entries: any[] | undefined): any[] | undefined {
    if (!Array.isArray(entries)) return entries;
    return entries.map((entry) => ({
      ...entry,
      label: this.text(pluginSlug, `${base}.${entry?.name}.label`, entry?.label),
      description: this.text(pluginSlug, `${base}.${entry?.name}.description`, entry?.description),
    }));
  }

  /** The translation, else the declared text untouched — including `undefined`, so no key is added. */
  private text<T>(pluginSlug: string, key: string, declared: T): T | string {
    // Only a plain string is translated: a locale map, a number or nothing is left exactly as declared.
    if (!declared || declared !== String(declared)) return declared;
    return this.lookup(pluginSlug, key) || declared;
  }

  private static collectionKey(collection: Record<string, any>): string {
    return String(collection.shortSlug || collection.unprefixedSlug || collection.slug || '');
  }
}

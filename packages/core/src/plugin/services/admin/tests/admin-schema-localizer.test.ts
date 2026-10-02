import { describe, expect, it } from 'vitest';
import { AdminSchemaLocalizer } from '@core/plugin/services/admin/admin-schema-localizer';

/** A plugin's admin text in the console's language, from the plugin's own dictionary, literal otherwise. */
describe('AdminSchemaLocalizer', () => {
  const dictionary: Record<string, string> = {
    'shop.admin.label': 'Магазин',
    'shop.admin.description': 'Каталог, колички и поръчки.',
    'shop.admin.category': 'Търговия',
    'shop.admin.collections.catalog.fields.leadMin.emptyMeans.standardDispatchMinDays': 'не се показва срок за доставка.',
    'shop.admin.groups.e-commerce-catalog': 'Каталог',
    'shop.admin.menu.overview': 'Преглед',
    'shop.admin.collections.catalog.label': 'Продукти',
    'shop.admin.collections.catalog.fields.name.label': 'Име',
    'shop.admin.collections.catalog.fields.status.options.draft': 'Чернова',
    'shop.admin.collections.catalog.fields.variants.fields.sku.label': 'Код',
    'shop.admin.collections.catalog.tabs.pricing': 'Цени',
    'shop.admin.collections.catalog.sections.stock-and-shipping.label': 'Наличност и доставка',
    'shop.admin.settings.tabs.checkout': 'Поръчване',
    'shop.admin.settings.fields.orderNumberPrefix.description': 'Пред номера.',
    'shop.admin.collections.catalog.fields.history.keyLabels.changedBy': 'Променено от',
  };
  const localizer = new AdminSchemaLocalizer((plugin, key) => dictionary[`${plugin}.${key}`] || '');

  it("translates a field another plugin added from that plugin's dictionary, not the owner's", () => {
    const words = { ...dictionary, 'seo.admin.extendedFields.ogTitle.label': 'OG заглавие', 'seo.admin.extendedFields.ogTitle.description': 'Заглавие за социалните мрежи.' };
    const out = new AdminSchemaLocalizer((plugin, key) => words[`${plugin}.${key}`] || '').collection('shop', {
      slug: 'shop-products',
      shortSlug: 'catalog',
      fields: [
        { name: 'name', label: 'Product Name' },
        { name: 'ogTitle', label: 'OG Title', extendedBy: 'seo', admin: { description: 'Open Graph title.' } },
        { name: 'canonicalUrl', label: 'Canonical URL', extendedBy: 'seo' },
      ],
    });
    expect(out.fields.map((field: any) => field.label)).toEqual(['Име', 'OG заглавие', 'Canonical URL']);
    expect(out.fields[1].admin.description).toBe('Заглавие за социалните мрежи.');
    expect(out.fields[1].extendedBy).toBe('seo');
  });

  it('translates a collection, its fields, options, sub-fields and tabs', () => {
    const out = localizer.collection('shop', {
      slug: 'shop-products',
      shortSlug: 'catalog',
      displayName: 'Product Catalog',
      admin: { tabs: [{ name: 'pricing', label: 'Pricing' }, { name: 'seo', label: 'SEO' }] },
      fields: [
        { name: 'name', label: 'Product Name', admin: { description: 'Shown to shoppers.', section: 'Stock and Shipping' } },
        { name: 'status', label: 'Status', options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }] },
        { name: 'variants', label: 'Variants', fields: [{ name: 'sku', label: 'SKU' }] },
      ],
    });
    expect(out.displayName).toBe('Продукти');
    expect(out.admin.tabs.map((tab: any) => tab.label)).toEqual(['Цени', 'SEO']);
    expect(out.fields[0].label).toBe('Име');
    expect(out.fields[0].admin.description).toBe('Shown to shoppers.');
    expect(out.fields[0].admin.section).toBe('Наличност и доставка');
    expect(out.fields[1].options.map((option: any) => option.label)).toEqual(['Чернова', 'Published']);
    expect(out.fields[2].fields[0].label).toBe('Код');
  });

  it('translates the key names a structured read-only field prints, keeping untranslated ones as declared', () => {
    const out = localizer.collection('shop', {
      slug: 'shop-products',
      shortSlug: 'catalog',
      fields: [{ name: 'history', admin: { component: 'StructuredReadOnlyField', keyLabels: { changedBy: 'Changed by', note: 'Note' } } }],
    });
    expect(out.fields[0].admin.keyLabels).toEqual({ changedBy: 'Променено от', note: 'Note' });
  });

  it('leaves text a dictionary lacks exactly as declared, and adds nothing that was not declared', () => {
    const field = { name: 'sku', type: 'text' };
    const out = new AdminSchemaLocalizer(() => '').collection('other', { slug: 'x', fields: [field] });
    expect(out.fields[0]).toEqual({ ...field, label: undefined, placeholder: undefined });
    expect(out.displayName).toBeUndefined();
  });

  it('translates a settings schema', () => {
    const out = localizer.settings('shop', {
      tabs: [{ id: 'checkout', label: 'Checkout' }],
      fields: [{ name: 'orderNumberPrefix', label: 'Order Number Prefix', admin: { description: 'Before the number.' } }],
    });
    expect(out.tabs[0].label).toBe('Поръчване');
    expect(out.fields[0].label).toBe('Order Number Prefix');
    expect(out.fields[0].admin.description).toBe('Пред номера.');
  });

  it('translates plugin menu entries and groups, and leaves the framework\'s own to the console', () => {
    const out = localizer.menu([
      { label: 'Dashboard', path: '/', pluginSlug: 'system', group: 'Core' },
      { label: 'Shop', isGroup: true, pluginSlug: 'shop', group: 'E-commerce Catalog', path: '/shop', children: [
        { label: 'Overview', path: '/shop', pluginSlug: 'shop', group: 'E-commerce Catalog' },
        { label: 'Product Catalog', path: '/shop/catalog', pluginSlug: 'shop', group: 'E-commerce Catalog' },
        { label: 'Reports', path: '/shop/reports', pluginSlug: 'shop' },
      ] },
    ], () => 'Shop');
    expect(out[0]).toEqual({ label: 'Dashboard', path: '/', pluginSlug: 'system', group: 'Core' });
    expect(out[1].label).toBe('Магазин');
    expect(out[1].group).toBe('Каталог');
    expect(out[1].children.map((child: any) => child.label)).toEqual(['Преглед', 'Продукти', 'Reports']);
  });

  it('translates a plugin\'s name, description and category for the plugin list', () => {
    const out = localizer.manifest('shop', { slug: 'shop', name: 'Shop', description: 'Catalog, carts and orders.', category: 'commerce', version: '1.0.0' });
    expect(out).toEqual({ slug: 'shop', name: 'Магазин', description: 'Каталог, колички и поръчки.', category: 'Търговия', version: '1.0.0' });
    expect(new AdminSchemaLocalizer(() => '').manifest('other', { name: 'Other' })).toEqual({ name: 'Other', description: undefined });
  });

  it('translates what an empty field means, per fallback rule', () => {
    const out = localizer.collection('shop', {
      slug: 'shop-products', shortSlug: 'catalog',
      fields: [{ name: 'leadMin', admin: { fallback: [{ settingKey: 'standardDispatchMinDays', emptyMeans: 'no delivery window is shown.' }, { settingKey: 'other', emptyMeans: 'kept.' }] } }],
    });
    expect(out.fields[0].admin.fallback.map((rule: any) => rule.emptyMeans)).toEqual(['не се показва срок за доставка.', 'kept.']);
  });
});

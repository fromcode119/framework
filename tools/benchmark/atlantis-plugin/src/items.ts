export class BenchItems {
  static readonly shortSlug = 'items' as const;
  static readonly slug = 'benchitems-items' as const;
  static readonly displayName = 'Items' as const;
  static readonly admin = { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'price', 'stock'], group: 'Bench' } as const;
  static readonly access = { read: true } as const;
  static readonly fields = [
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'slug', type: 'text', label: 'Slug', required: true, unique: true },
    { name: 'description', type: 'textarea', label: 'Description' },
    { name: 'price', type: 'number', label: 'Price' },
    { name: 'sku', type: 'text', label: 'SKU' },
    { name: 'stock', type: 'number', label: 'Stock' },
  ] as const;
}

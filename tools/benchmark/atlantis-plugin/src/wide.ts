export class BenchWide {
  static readonly shortSlug = 'wide' as const;
  static readonly slug = 'benchitems-wide' as const;
  static readonly displayName = 'Wide items' as const;
  static readonly admin = { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'price'], group: 'Bench' } as const;
  static readonly access = { read: true } as const;
  static readonly fields = [
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'slug', type: 'text', label: 'Slug', required: true, unique: true },
    { name: 'description', type: 'textarea', label: 'Description' },
    { name: 'price', type: 'number', label: 'Price' },
    { name: 'sku', type: 'text', label: 'SKU' },
    { name: 'stock', type: 'number', label: 'Stock' },
    { name: 'subtitle', type: 'text', label: 'subtitle' },
    { name: 'summary', type: 'text', label: 'summary' },
    { name: 'seoTitle', type: 'text', label: 'seoTitle' },
    { name: 'seoDescription', type: 'text', label: 'seoDescription' },
    { name: 'canonicalUrl', type: 'text', label: 'canonicalUrl' },
    { name: 'metaRobots', type: 'text', label: 'metaRobots' },
    { name: 'brand', type: 'text', label: 'brand' },
    { name: 'color', type: 'text', label: 'color' },
    { name: 'material', type: 'text', label: 'material' },
    { name: 'barcode', type: 'text', label: 'barcode' },
    { name: 'weight', type: 'number', label: 'weight' },
    { name: 'width', type: 'number', label: 'width' },
    { name: 'height', type: 'number', label: 'height' },
    { name: 'depth', type: 'number', label: 'depth' },
    { name: 'rating', type: 'number', label: 'rating' },
    { name: 'reviewCount', type: 'number', label: 'reviewCount' },
    { name: 'costPrice', type: 'number', label: 'costPrice' },
    { name: 'salePrice', type: 'number', label: 'salePrice' },
    { name: 'featured', type: 'checkbox', label: 'featured' },
    { name: 'hidden', type: 'checkbox', label: 'hidden' },
    { name: 'taxable', type: 'checkbox', label: 'taxable' },
    { name: 'shippable', type: 'checkbox', label: 'shippable' },
    { name: 'backorders', type: 'checkbox', label: 'backorders' },
    { name: 'giftWrap', type: 'checkbox', label: 'giftWrap' },
    { name: 'publishAt', type: 'datetime', label: 'publishAt' },
    { name: 'promoStart', type: 'datetime', label: 'promoStart' },
    { name: 'promoEnd', type: 'datetime', label: 'promoEnd' },
    { name: 'discontinuedAt', type: 'datetime', label: 'discontinuedAt' },
    { name: 'attributes', type: 'json', label: 'attributes', admin: { component: 'StructuredReadOnlyField', description: 'Benchmark data.' } },
    { name: 'extra', type: 'json', label: 'extra', admin: { component: 'StructuredReadOnlyField', description: 'Benchmark data.' } },
  ] as const;
}

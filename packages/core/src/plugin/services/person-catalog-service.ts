import { SystemConstants } from '../../constants';

interface CatalogDb {
  find(table: string, opts?: any): Promise<any[]>;
  findOne(table: string, where: any): Promise<any | null>;
  insert(table: string, data: any): Promise<any>;
  update(table: string, where: any, data: any): Promise<any>;
}

export class PersonCatalogService {
  private static readonly DEFAULTS: { kind: string; key: string; label: string }[] = [
    { kind: 'status', key: 'active', label: 'people.status.active' },
    { kind: 'status', key: 'inactive', label: 'people.status.inactive' },
    { kind: 'status', key: 'archived', label: 'people.status.archived' },
    { kind: 'source', key: 'self', label: 'people.source.self' },
    { kind: 'source', key: 'contact', label: 'people.source.contact' }
  ];

  constructor(private readonly db: CatalogDb) {}

  async register(kind: string, entry: { key: string; label: string; pluginSlug?: string }): Promise<void> {
    const normalizedKind = String(kind ?? '').trim();
    const key = String(entry?.key ?? '').trim();
    if (!normalizedKind || !key) return;

    const existing = await this.db.findOne(SystemConstants.TABLE.PERSON_CATALOGS, { kind: normalizedKind, key });
    if (existing) return;

    await this.db.insert(SystemConstants.TABLE.PERSON_CATALOGS, {
      kind: normalizedKind,
      key,
      label: String(entry?.label ?? key),
      pluginSlug: entry?.pluginSlug ?? null
    });
  }

  async list(kind: string): Promise<{ key: string; label: string }[]> {
    const rows = await this.db.find(SystemConstants.TABLE.PERSON_CATALOGS, { where: { kind: String(kind ?? '').trim() } });
    return (Array.isArray(rows) ? rows : []).map((r) => ({ key: String(r?.key ?? ''), label: String(r?.label ?? '') }));
  }

  async seedDefaults(): Promise<void> {
    for (const d of PersonCatalogService.DEFAULTS) {
      await this.register(d.kind, { key: d.key, label: d.label });
    }
  }
}

import { PluginManager } from '@fromcode119/core';
import { IDatabaseManager, PhysicalTableNameUtils } from '@fromcode119/database';
import { AdminSearchResponse, AdminSearchResult } from './admin-search-service.interfaces';

/**
 * Global admin search — the data source behind the command palette. Fans out one LIKE query per
 * registered (non-hidden) plugin collection using the dialect-pushed `search` option, plus the
 * framework `users` and `people` tables, and returns a flat ranked result list. Appearance-agnostic:
 * collections are discovered from the registry (never hardcoded), and the caller decides navigation.
 */
export class AdminSearchService {
  /** Field names worth matching against, in label-priority order (intersected with each schema). */
  private static readonly CANDIDATE_FIELDS = [
    'name', 'title', 'fullName', 'companyName', 'email', 'customerEmail', 'code', 'orderNumber',
    'invoiceNumber', 'sku', 'label', 'slug',
  ];

  private static readonly PER_SOURCE_LIMIT = 5;
  private static readonly TOTAL_LIMIT = 30;
  private static readonly MIN_QUERY_LENGTH = 2;

  constructor(
    private readonly manager: PluginManager,
    private readonly db: IDatabaseManager,
  ) {}

  async search(rawQuery: unknown): Promise<AdminSearchResponse> {
    const query = String(rawQuery ?? '').trim();
    if (query.length < AdminSearchService.MIN_QUERY_LENGTH) return { query, results: [] };

    const results: AdminSearchResult[] = [];
    await this.searchSystemPeople(query, results);
    await this.searchCollections(query, results);
    return { query, results: results.slice(0, AdminSearchService.TOTAL_LIMIT) };
  }

  /** Framework identity tables — searched directly (this is a framework-owned service). */
  private async searchSystemPeople(query: string, out: AdminSearchResult[]): Promise<void> {
    try {
      const users = await this.db.find('users', {
        search: { columns: ['email', 'first_name', 'last_name'], value: query },
        limit: AdminSearchService.PER_SOURCE_LIMIT,
      });
      for (const u of users || []) {
        out.push({
          group: 'Users', source: 'users', pluginSlug: '',
          id: u.id,
          label: [u.first_name, u.last_name].filter(Boolean).join(' ') || String(u.email || ''),
          sublabel: String(u.email || ''),
        });
      }
    } catch { /* table shape drift must never break search */ }
    try {
      const people = await this.db.find('people', {
        search: { columns: ['display_name', 'first_name', 'last_name', 'primary_email'], value: query },
        limit: AdminSearchService.PER_SOURCE_LIMIT,
      });
      for (const p of people || []) {
        out.push({
          group: 'People', source: 'people', pluginSlug: '',
          id: p.id,
          label: String(p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.primary_email || ''),
          sublabel: String(p.primary_email || ''),
        });
      }
    } catch { /* ignore */ }
  }

  /** Every registered, non-hidden plugin collection, matched on its title-ish text fields. */
  private async searchCollections(query: string, out: AdminSearchResult[]): Promise<void> {
    for (const [, entry] of this.manager.registeredCollections) {
      if (out.length >= AdminSearchService.TOTAL_LIMIT) return;
      const collection: any = entry.collection;
      if (collection?.admin?.hidden) continue;
      const fieldNames = this.searchableFields(collection);
      if (!fieldNames.length) continue;
      try {
        const rows = await this.db.find(String(collection.slug), {
          search: { columns: fieldNames.map((f) => this.toSnake(f)), value: query },
          limit: AdminSearchService.PER_SOURCE_LIMIT,
        });
        for (const row of rows || []) {
          out.push(this.mapRow(collection, entry.pluginSlug, row, fieldNames));
        }
      } catch { /* a single collection failing (missing table, dialect quirk) must never break search */ }
    }
  }

  private searchableFields(collection: any): string[] {
    const fields: any[] = Array.isArray(collection?.fields) ? collection.fields : [];
    const textFields = new Set(
      fields
        .filter((f) => ['text', 'email'].includes(String(f?.type)) && f?.name)
        .map((f) => String(f.name)),
    );
    const useAsTitle = String(collection?.admin?.useAsTitle || '');
    const picked = AdminSearchService.CANDIDATE_FIELDS.filter((name) => textFields.has(name));
    if (useAsTitle && textFields.has(useAsTitle) && !picked.includes(useAsTitle)) picked.unshift(useAsTitle);
    return picked.slice(0, 4);
  }

  private mapRow(collection: any, pluginSlug: string, row: any, fieldNames: string[]): AdminSearchResult {
    const read = (name: string) => row?.[this.toSnake(name)] ?? row?.[name];
    const titleField = String(collection?.admin?.useAsTitle || '') || fieldNames[0];
    const label = String(read(titleField) || read(fieldNames[0]) || `#${row?.id}`);
    const sublabel = fieldNames.map(read).map((v) => String(v ?? '')).find((v) => v && v !== label) || '';
    return {
      group: this.groupLabel(collection, pluginSlug),
      source: String(collection?.slug || ''),
      pluginSlug: String(pluginSlug || ''),
      id: row?.id,
      label,
      sublabel,
    };
  }

  /**
   * A human group label — never a raw machine slug. Prefer a display name the owning collection
   * declares; otherwise humanize the slug (drop the `fcp_`/plugin prefix, split, Title Case) so the
   * palette shows "Tiers", not "mlm-tiers"/"fcp_mlm_tiers". Generic — no plugin names hardcoded.
   */
  private groupLabel(collection: any, pluginSlug: string): string {
    const declared = collection?.admin?.label || collection?.labels?.plural || collection?.label || collection?.name;
    if (declared) return String(declared);
    const slug = String(collection?.slug || '').trim();
    if (!slug) return 'Records';
    const withoutPlatformPrefix = slug.startsWith(PhysicalTableNameUtils.PLATFORM_PREFIX)
      ? slug.slice(PhysicalTableNameUtils.PLATFORM_PREFIX.length)
      : slug;
    const stripped = withoutPlatformPrefix
      .replace(new RegExp(`^${String(pluginSlug || '').toLowerCase()}[-_]`), '');
    const words = (stripped || slug).split(/[-_]+/).filter(Boolean);
    if (!words.length) return 'Records';
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  private toSnake(name: string): string {
    return name.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}

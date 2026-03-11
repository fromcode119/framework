import { IDatabaseManager } from '@fromcode119/database';
import { Collection, Logger } from '@fromcode119/core';

export class SuggestionService {
  private logger = new Logger({ namespace: 'Suggestions' });

  constructor(private db: IDatabaseManager) {}

  async getSuggestions(collection: Collection, field: string, q?: string) {
    try {
      const config = collection.fields.find(f => f.name === field);

      if (!config && field !== 'id' && field !== 'slug' && field !== 'username') {
        this.logger.warn(`Suggestions requested for non-existent field "${field}" in collection "${collection.slug}"`);
        return [];
      }

      const tableName = collection.tableName || collection.slug;
      const search = String(q || '').trim().toLowerCase();

      if (config && (config.type === 'json' || config.admin?.component === 'TagField' || config.admin?.component === 'Tags')) {
        const rows = await this.db.find(tableName, {
          columns: { [field]: true },
          limit: 300
          // Note: JSON/tags fields are stored as serialized arrays — LIKE on the raw
          // JSON string is unreliable, so search filtering is done in JS below.
        });

        const seen = new Set<string>();
        const out: Array<{ label: string; value: string }> = [];

        const pushCandidate = (candidate: unknown) => {
          const value = String(candidate ?? '').trim();
          if (!value) return;
          if (search && !value.toLowerCase().includes(search)) return;
          if (seen.has(value)) return;
          seen.add(value);
          out.push({ label: value, value });
        };

        for (const row of rows) {
          const raw = row[field];
          if (raw === null || raw === undefined) continue;

          if (Array.isArray(raw)) {
            for (const entry of raw) pushCandidate(entry);
          } else if (typeof raw === 'string') {
            const normalized = raw.trim();
            if (!normalized) continue;

            if (normalized.startsWith('[') && normalized.endsWith(']')) {
              try {
                const parsed = JSON.parse(normalized);
                if (Array.isArray(parsed)) {
                  for (const entry of parsed) pushCandidate(entry);
                }
              } catch {
                pushCandidate(normalized);
              }
            } else {
              pushCandidate(normalized);
            }
          } else {
            pushCandidate(raw);
          }

          if (out.length >= 50) break;
        }

        return out.slice(0, 50);
      } else {
        const isUserSearch = collection.slug === 'users' && (field === 'username' || field === 'email');
        const labelFieldName = collection.admin?.useAsTitle || field;

        const columnsToFetch: Record<string, boolean> = { [field]: true };
        if (labelFieldName !== field) columnsToFetch[labelFieldName] = true;
        if (isUserSearch) {
          columnsToFetch['username'] = true;
          columnsToFetch['email'] = true;
        }

        const searchColumns = isUserSearch ? ['username', 'email'] : [field];

        const rows = await this.db.find(tableName, {
          columns: columnsToFetch,
          ...(search ? { search: { columns: searchColumns, value: search } } : {}),
          limit: 50
        });

        const seen = new Set<string>();
        const out: Array<{ label: string; value: string }> = [];

        for (const row of rows) {
          const value = row[field];
          if (value === null || value === undefined) continue;

          const strValue = String(value);
          if (seen.has(strValue)) continue;
          seen.add(strValue);

          const label = row[labelFieldName] ?? strValue;
          out.push({ label: String(label), value: strValue });
        }

        return out;
      }
    } catch (err: any) {
      this.logger.error(`Suggestions error in ${collection.slug} for ${field}:`, err);
      throw err;
    }
  }
}
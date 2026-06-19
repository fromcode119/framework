import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AdminServices } from '@/lib/admin-services';
import { TagFieldUtils } from './utils';
import type { TagFieldProps, TagOption } from './interfaces';

/**
 * Encapsulates the network/data logic for {@link TagField}: parsing the stored value
 * into tags, resolving missing labels, fetching suggestions, and background auto-creation.
 * The host component supplies its current props/state and receives updates via callbacks,
 * keeping the React class thin without changing behavior.
 */
export class TagFieldDataService {
  static parseTags(value: string[] | string, hasMany = true): any[] {
    if (Array.isArray(value)) return value.filter(v => v !== null && v !== undefined);
    if (value !== null && value !== undefined && typeof value === 'string' && value.trim()) {
      if (!hasMany) return [value];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(v => v !== null && v !== undefined) : [value];
      } catch (e) {
        return [value];
      }
    }
    if (value !== null && value !== undefined && !Array.isArray(value) && typeof value !== 'string') {
      return [String(value)];
    }
    return [];
  }

  static resolveCollectionCandidates(sourceCollection?: string): string[] {
    return TagFieldUtils.resolveCollectionCandidates(String(sourceCollection || ''));
  }

  static async fetchLabels(params: {
    props: TagFieldProps;
    tags: any[];
    labels: Record<string, string>;
    sourceUnavailableMessage: string;
    setSourceUnavailable: (message: string) => void;
    mergeLabels: (labels: Record<string, string>) => void;
  }): Promise<void> {
    const { props, tags, labels, sourceUnavailableMessage, setSourceUnavailable, mergeLabels } = params;
    const { sourceCollection, sourceField, apiOverrides } = props;
    const sourceCollectionCandidates = TagFieldDataService.resolveCollectionCandidates(sourceCollection);

    if (!sourceCollection || tags.length === 0) return;
    if (sourceUnavailableMessage) return;

    const missing = tags.filter(t => !labels[t]);
    if (missing.length === 0) return;

    try {
      const searchKey = sourceField || 'slug';
      const newLabels = { ...labels };
      await Promise.all(missing.map(async (t) => {
         try {
           let doc: any = null;

           const collectionsToTry = sourceCollectionCandidates.length
             ? sourceCollectionCandidates
             : [String(sourceCollection || '').trim()];

           for (const candidateCollection of collectionsToTry) {
             if (!candidateCollection || doc) break;

             if (!apiOverrides?.search && !isNaN(Number(t))) {
               try {
                 const byIdUrl = `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${candidateCollection}/${t}`;
                 const byId = await AdminApi.get(byIdUrl);
                 if (byId && (byId.id || byId._id || byId.slug)) {
                   doc = byId;
                   break;
                 }
               } catch {
                 // ignore and continue with field lookup fallback
               }
             }

             try {
               const url = apiOverrides?.search
                 ? `${apiOverrides.search}?q=${encodeURIComponent(t)}`
                 : `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${candidateCollection}?${searchKey}=${encodeURIComponent(t)}&limit=1`;

               const res = await AdminApi.get(url);
               const maybeDoc = apiOverrides?.search ? res : res.docs?.[0];
               if (maybeDoc) {
                 doc = maybeDoc;
                 break;
               }
             } catch {
               // try next collection candidate
             }
           }

           if (doc) {
             newLabels[t] = AdminServices.getInstance().localization.resolveLabelText(doc) || t;
           } else {
              newLabels[t] = t;
           }
         } catch (e: any) {
           const message = String(e?.message || '');
           if (e?.status === 403 && message.includes('is unavailable because plugin')) {
             setSourceUnavailable(message);
           }
         }
      }));
      mergeLabels(newLabels);
    } catch (err) {}
  }

  static async fetchSuggestions(params: {
    props: TagFieldProps;
    inputValue: string;
    sourceUnavailableMessage: string;
    tags: any[];
    setSuggestions: (suggestions: TagOption[]) => void;
    setSourceUnavailable: (message: string) => void;
    setSourceUnavailableWithSuggestions: (message: string) => void;
    mergeLabels: (labels: Record<string, string>) => void;
  }): Promise<void> {
    const {
      props, inputValue, sourceUnavailableMessage, tags,
      setSuggestions, setSourceUnavailable, setSourceUnavailableWithSuggestions, mergeLabels,
    } = params;
    const { sourceCollection, collectionSlug, sourceField, fieldName, apiOverrides } = props;
    const sourceCollectionCandidates = TagFieldDataService.resolveCollectionCandidates(sourceCollection);

    if (inputValue.length < 1 && !sourceCollection) {
      setSuggestions([]);
      return;
    }
    if (sourceCollection && sourceUnavailableMessage) {
      setSuggestions([]);
      return;
    }

    try {
      const targetCollection = sourceCollection || collectionSlug;
      const targetField = sourceField || fieldName;

      if (!targetCollection && !apiOverrides?.suggest) return;

      const isRelationship = !!sourceCollection;
      const collectionsToTry = sourceCollection
        ? sourceCollectionCandidates
        : [String(targetCollection || '').trim()];
      const q = encodeURIComponent(inputValue);

      let result: any = null;
      let lastError: any = null;
      if (apiOverrides?.suggest) {
        result = await AdminApi.get(`${apiOverrides.suggest}?q=${q}`);
      } else {
        for (const candidateCollection of collectionsToTry) {
          if (!candidateCollection) continue;
          const url = isRelationship
            ? `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${candidateCollection}?limit=10${inputValue ? `&search=${q}` : ''}`
            : `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${candidateCollection}/suggestions/${targetField}?q=${q}&limit=10`;
          try {
            result = await AdminApi.get(url);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!result && lastError) {
          throw lastError;
        }
      }
      setSourceUnavailable('');

      const docs = Array.isArray(result) ? result : (result.docs || []);

      if (docs.length > 0) {
        const mapped: TagOption[] = docs.map((item: any) => {
          if (typeof item === 'string') return { label: item, value: item };
          if (typeof item === 'object' && item !== null) {
            let rawValue =
              sourceCollection
                ? (item.id ?? item._id ?? item.value ?? item.slug)
                : (
                    (sourceField && item[sourceField] !== undefined && item[sourceField] !== null
                      ? item[sourceField]
                      : undefined) ??
                    item.value ??
                    item.slug ??
                    item.id ??
                    item.name ??
                    item.label
                  );

            if (typeof rawValue === 'object' && rawValue !== null) {
              rawValue = AdminServices.getInstance().localization.resolveLabelText(rawValue);
            }

            const value = String(rawValue || '').trim();
            const label = String(AdminServices.getInstance().localization.resolveLabelText(item) || value || 'Unknown').trim();

            return { label, value: value || label };
          }
          return { label: String(item), value: String(item) };
        });

        setSuggestions(mapped.filter(s => s.value && !tags.includes(s.value)));

        const newLabels: Record<string, string> = {};
        mapped.forEach(m => { if (m.value) newLabels[m.value] = m.label; });
        mergeLabels(newLabels);
      }
    } catch (err) {
      const message = String((err as any)?.message || '');
      const status = (err as any)?.status;
      if (status === 403 && message.includes('is unavailable because plugin')) {
        setSourceUnavailableWithSuggestions(message);
        return;
      }
      console.error("Failed to fetch suggestions", err);
    }
  }

  static async autoCreate(props: TagFieldProps, strValue: string): Promise<void> {
    const { allowCreate = true, sourceCollection, sourceField, apiOverrides } = props;
    if (!(allowCreate && (sourceCollection || apiOverrides?.create))) return;
    try {
      const searchKey = sourceField || 'slug';
      const searchUrl = apiOverrides?.search
        ? `${apiOverrides.search}?q=${encodeURIComponent(strValue)}`
        : `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}?${searchKey}=${encodeURIComponent(strValue)}&limit=1`;

      const existing = await AdminApi.get(searchUrl);
      const hasExisting = apiOverrides?.search ? !!existing : (existing.docs && existing.docs.length > 0);

      if (!hasExisting) {
        const payload: Record<string, any> = {
          name: strValue,
          slug: AdminServices.getInstance().string.slugify(strValue)
        };
        const createUrl = apiOverrides?.create || `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${sourceCollection}`;
        await AdminApi.post(createUrl, payload);
      }
    } catch (err) {
      console.error("Tag auto-creation failed:", err);
    }
  }
}

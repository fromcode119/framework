import { CollectionQueryUtils } from '@fromcode119/react';
import { AdminServices } from '@/lib/admin-services';
import { RelationshipSelectLocalUtils } from './relationship-select-local-utils';
import type { RelationshipFetchContext, SelectOption } from './relationship-select-local.interfaces';

export class RelationshipSelectLocalFetcher {
  private ctx: RelationshipFetchContext;

  constructor(ctx: RelationshipFetchContext) {
    this.ctx = ctx;
  }

  private resolveLookupField(sourceCollectionSlug: string): string {
    const { field, collections } = this.ctx;
    const sourceCollection = (collections || []).find((entry: any) => entry.slug === sourceCollectionSlug);
    const preferredLabelField =
      sourceCollection?.admin?.useAsTitle ||
      (sourceCollectionSlug === 'users' ? 'username' : sourceCollectionSlug === 'media' ? 'filename' : 'name');
    return field.admin?.sourceField || preferredLabelField;
  }

  private mapDocsToOptions(docs: any[], sourceCollectionSlug: string): SelectOption[] {
    const { isMultiSource, docByKey, rawValueMap } = this.ctx;
    const seen = new Set<string>();
    const mapped: SelectOption[] = [];
    const lookupField = this.resolveLookupField(sourceCollectionSlug);
    for (const doc of docs) {
      const rawValue = doc?.id ?? doc?._id ?? doc?.value ?? doc?.slug;
      const scalarValue = RelationshipSelectLocalUtils.toScalar(rawValue);
      const optionValue = isMultiSource
        ? RelationshipSelectLocalUtils.toOptionKey(scalarValue, sourceCollectionSlug)
        : scalarValue;
      if (!optionValue || seen.has(optionValue)) continue;
      seen.add(optionValue);
      docByKey[optionValue] = doc;
      rawValueMap[optionValue] = isMultiSource
        ? RelationshipSelectLocalUtils.buildTaggedValue(rawValue ?? scalarValue, sourceCollectionSlug)
        : rawValue ?? optionValue;
      const preferredLabel =
        AdminServices.getInstance().localization.resolveLabelText(doc?.[lookupField]) ||
        AdminServices.getInstance().localization.resolveLabelText(doc);
      mapped.push({
        value: optionValue,
        label: preferredLabel || optionValue
      });
    }
    return mapped;
  }

  private async resolveSelectedLabel(): Promise<void> {
    const {
      api, value, isMultiSource, currentTarget, currentValue,
      currentSelectValue, sourceCollectionSlugs, rawValueMap, disposed, upsertOption
    } = this.ctx;

    const candidateSlugs = currentTarget && isMultiSource
      ? [currentTarget, ...sourceCollectionSlugs.filter((entry) => entry !== currentTarget)]
      : sourceCollectionSlugs;

    for (const sourceCollectionSlug of candidateSlugs) {
      const lookupField = this.resolveLookupField(sourceCollectionSlug);
      try {
        const byId = await CollectionQueryUtils.queryCollectionDocById(api, sourceCollectionSlug, currentValue);
        const resolved = this.mapDocsToOptions([byId], sourceCollectionSlug)[0];
        if (resolved && !disposed()) {
          upsertOption(resolved);
          return;
        }
      } catch {
        try {
          const byFieldDoc = await CollectionQueryUtils.queryCollectionDocByField(api, sourceCollectionSlug, lookupField, currentValue, 1);
          const resolved = byFieldDoc ? this.mapDocsToOptions([byFieldDoc], sourceCollectionSlug)[0] : undefined;
          if (resolved && !disposed()) {
            upsertOption(resolved);
            return;
          }
        } catch {
          continue;
        }
      }
    }

    if (!disposed()) {
      rawValueMap[currentSelectValue || currentValue] = value;
      upsertOption({ value: currentSelectValue || currentValue, label: currentValue });
    }
  }

  async fetch(): Promise<void> {
    const {
      api, value, sourceCollectionSlugs, currentValue, currentSelectValue,
      search, rawValueMap, disposed, setOptions, upsertOption
    } = this.ctx;
    if (!sourceCollectionSlugs.length) return;

    try {
      const responses = await Promise.all(
        sourceCollectionSlugs.map(async (sourceCollectionSlug) => {
          const docs = await CollectionQueryUtils.queryCollectionDocs(api, sourceCollectionSlug, {
            limit: 30,
            search: search.trim() || undefined
          });
          return this.mapDocsToOptions(docs, sourceCollectionSlug);
        })
      );
      const nextOptions = responses.flat().filter((option, index, entries) => (
        entries.findIndex((entry) => entry.value === option.value) === index
      ));

      if (!disposed()) {
        setOptions(nextOptions);
      }

      if (!currentValue || nextOptions.some((option) => option.value === currentSelectValue)) return;

      // Ensure the currently selected value resolves to a label.
      await this.resolveSelectedLabel();
    } catch {
      if (!disposed() && currentValue) {
        rawValueMap[currentSelectValue || currentValue] = value;
        upsertOption({ value: currentSelectValue || currentValue, label: currentValue });
      }
    }
  }
}

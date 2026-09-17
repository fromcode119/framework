import type { IAssistantSessionCheckpoint } from '@ai/admin-assistant-runtime/interfaces/assistant-session-checkpoint.interface';
import { OrchestratorListingUtils } from '@ai/admin-assistant-runtime/runtime/orchestrator-listing-utils';

/**
 * Working out WHICH row and which field a person meant, from what they typed.
 *
 * "the second one", "the Acme order", "its status" — a person refers to a listing the way they would
 * to a page they can see, and the assistant has to map that onto a record it fetched. Matching is
 * deliberately forgiving about case and partial names, because the alternative is demanding an id
 * from somebody who is looking at a table.
 */
export class ListingFieldResolver {
  static resolveTargetRowIndex(message: string, docs: any[], listingMemory: NonNullable<IAssistantSessionCheckpoint['memory']>['listing'] | null): number {
    const explicit = OrchestratorListingUtils.parseRecordIndexHint(message);
  if (Number.isFinite(Number(explicit))) {
    const idx = Number(explicit);
    if (!docs.length) return Math.max(0, idx);
    return Math.max(0, Math.min(docs.length - 1, idx));
  }
    const byMention = OrchestratorListingUtils.findRecordIndexByMention(message, docs);
  if (Number.isFinite(Number(byMention))) {
    const idx = Number(byMention);
    if (!docs.length) return Math.max(0, idx);
    return Math.max(0, Math.min(docs.length - 1, idx));
  }
  const text = String(message || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const referencesPrevious = /\b(that one|this one|same one|him|her|them|their|his|its)\b/.test(text);
    if (listingMemory?.lastSelectedRecordId) {
      const fromIdentity = docs.findIndex((doc) => OrchestratorListingUtils.extractRecordIdentity(doc) === listingMemory.lastSelectedRecordId);
    if (fromIdentity >= 0) return fromIdentity;
  }
  if (referencesPrevious && Number.isFinite(Number(listingMemory?.lastSelectedRowIndex))) {
    const idx = Math.max(0, Number(listingMemory?.lastSelectedRowIndex));
    if (!docs.length) return idx;
    return Math.max(0, Math.min(docs.length - 1, idx));
  }
  if (Number.isFinite(Number(listingMemory?.lastSelectedRowIndex))) {
    const idx = Math.max(0, Number(listingMemory?.lastSelectedRowIndex));
    if (!docs.length) return idx;
    return Math.max(0, Math.min(docs.length - 1, idx));
  }
    return 0;
  }

  static pickFieldFromRecord(record: any, fieldHint: string, orderedFields: string[]): { key: string; value: string } | null {
  if (!record || typeof record !== 'object') return null;
  const scalarPairs = Object.entries(record).filter((entry) => {
    const value = entry[1];
    return value !== null && value !== undefined && typeof value !== 'object';
  });
  if (!scalarPairs.length) return null;

    const normalizedHint = OrchestratorListingUtils.normalizeFieldToken(fieldHint);
    if (normalizedHint) {
      const exact = scalarPairs.find(([key]) => {
        const normalizedKey = OrchestratorListingUtils.normalizeFieldToken(String(key || ''));
      return normalizedKey === normalizedHint || normalizedKey.includes(normalizedHint) || normalizedHint.includes(normalizedKey);
    });
    if (exact) {
      const key = String(exact[0] || 'value');
      const value = String(exact[1] || '').trim();
      if (value) return { key, value };
    }
  }

    const byOrderedPreferred = (Array.isArray(orderedFields) ? orderedFields : [])
      .filter((field) => !/\b(id|_id)\b/i.test(String(field || '')))
      .map((field) => {
        const normalizedField = OrchestratorListingUtils.normalizeFieldToken(field);
        return scalarPairs.find(([key]) => OrchestratorListingUtils.normalizeFieldToken(String(key || '')) === normalizedField);
    })
    .find(Boolean);
    const byOrderedAny = (Array.isArray(orderedFields) ? orderedFields : [])
      .map((field) => {
        const normalizedField = OrchestratorListingUtils.normalizeFieldToken(field);
        return scalarPairs.find(([key]) => OrchestratorListingUtils.normalizeFieldToken(String(key || '')) === normalizedField);
    })
    .find(Boolean);
  const byReadableString =
    scalarPairs.find(([, value]) => typeof value === 'string' && /[a-z]/i.test(String(value))) ||
    scalarPairs.find(([, value]) => typeof value === 'string');
  const byNonIdentifier = scalarPairs.find(([key]) => !/\b(id|_id)\b/i.test(String(key || '')));
  const chosen = byOrderedPreferred || byReadableString || byNonIdentifier || byOrderedAny || scalarPairs[0];
  const key = String(chosen?.[0] || 'value');
  const value = String(chosen?.[1] || '').trim();
  if (!value) return null;
    return { key, value };
  }

  static fieldMatchesHint(fieldKey: string, fieldHint: string): boolean {
    const key = OrchestratorListingUtils.normalizeFieldToken(fieldKey);
    const hint = OrchestratorListingUtils.normalizeFieldToken(fieldHint);
  if (!hint) return true;
  if (!key) return false;
    return key === hint || key.includes(hint) || hint.includes(key);
  }
}

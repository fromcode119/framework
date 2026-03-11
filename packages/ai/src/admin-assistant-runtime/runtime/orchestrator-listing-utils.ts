/** Orchestrator listing and record inspection utilities. Extracted from orchestrator.ts (ARC-007). */

import type { AssistantCollectionContext, AssistantSessionCheckpoint } from '../types';

/**
 * Utilities for orchestrator listing and record inspection operations.
 * All methods are static.
 */
export class OrchestratorListingUtils {
  static getListingMemory(checkpoint?: AssistantSessionCheckpoint): NonNullable<AssistantSessionCheckpoint['memory']>['listing'] | null {
  const listing = checkpoint?.memory?.listing;
  if (!listing || typeof listing !== 'object') return null;
  const collectionSlug = String(listing.collectionSlug || '').trim();
  if (!collectionSlug) return null;
  return {
    collectionSlug,
    lastSelectedRowIndex: Number.isFinite(Number(listing.lastSelectedRowIndex))
      ? Math.max(0, Number(listing.lastSelectedRowIndex))
      : undefined,
    lastSelectedRecordId: String(listing.lastSelectedRecordId || '').trim() || undefined,
    lastSelectedField: String(listing.lastSelectedField || '').trim() || undefined,
  };
  }

  static parseListingCollectionFromCheckpoint(checkpoint?: AssistantSessionCheckpoint): string {
    const fromMemory = OrchestratorListingUtils.getListingMemory(checkpoint);
  if (fromMemory?.collectionSlug) return fromMemory.collectionSlug;
  const resumePrompt = String(checkpoint?.resumePrompt || '').trim();
  if (!resumePrompt) return '';
  const match = resumePrompt.match(/continue from\s+([a-z0-9_-]+)\s+listing context/i);
    return String(match?.[1] || '').trim();
  }

  static parseListingCollectionFromHistory(history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): string {
  const source = Array.isArray(history) ? history : [];
  for (let i = source.length - 1; i >= 0; i -= 1) {
    if (source[i]?.role !== 'assistant') continue;
    const content = String(source[i]?.content || '');
    if (!content) continue;
    const foundMatch = content.match(/\bfound\s+\d+\s+records?\s+in\s+`?([a-z0-9_-]+)`?/i);
    if (foundMatch?.[1]) return String(foundMatch[1]).trim();
    const emptyMatch = content.match(/`([a-z0-9_-]+)`\s+currently has no records?/i);
    if (emptyMatch?.[1]) return String(emptyMatch[1]).trim();
    const followupMatch = content.match(/\bfor\s+`([a-z0-9_-]+)`\s*,\s*record\s+\d+/i);
    if (followupMatch?.[1]) return String(followupMatch[1]).trim();
  }
    return '';
  }

  static isRecordFollowupQuestion(message: string): boolean {
  const text = String(message || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const asks =
    /\b(what|which|who|show|tell)\b/.test(text) ||
    /\b(do|can)\s+you\s+(know|tell|show)\b/.test(text) ||
    /\b(name|email|phone|mobile|title|id)\b/.test(text) ||
    text.endsWith('?');
  const hasReference =
    /\b(his|her|their|that|this|first|second|third|field|value|record|entry)\b/.test(text) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) ||
    /\b[a-z][a-z0-9_]*\b/.test(text);
    return asks && hasReference;
  }

  static normalizeFieldToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
      .trim();
  }

  static escapeRegExp(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static splitFieldParts(value: string): string[] {
    return OrchestratorListingUtils.normalizeFieldToken(value)
    .split(' ')
    .map((part) => part.trim())
      .filter(Boolean);
  }

  static collectCollectionFieldNames(collection: AssistantCollectionContext | null | undefined, docs: any[]): string[] {
  const fromSchema = Array.isArray((collection as any)?.raw?.fields)
    ? (collection as any).raw.fields
        .map((field: any) => String(field?.name || '').trim())
        .filter(Boolean)
    : [];
  const fromDocs = new Set<string>();
  for (const doc of Array.isArray(docs) ? docs.slice(0, 6) : []) {
    if (!doc || typeof doc !== 'object') continue;
    for (const key of Object.keys(doc)) {
      const name = String(key || '').trim();
      if (name) fromDocs.add(name);
    }
  }
  const ordered = [...fromSchema, ...Array.from(fromDocs)];
  const seen = new Set<string>();
  const output: string[] = [];
    for (const field of ordered) {
      const normalized = OrchestratorListingUtils.normalizeFieldToken(field);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(field);
  }
    return output;
  }

  static extractMeaningfulTokens(message: string): string[] {
  const stopWords = new Set([
    'what', 'which', 'who', 'show', 'tell', 'is', 'are', 'the', 'a', 'an', 'of', 'for', 'to', 'from',
    'in', 'on', 'at', 'by', 'with', 'we', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could',
    'would', 'should', 'please', 'me', 'my', 'your', 'our', 'his', 'her', 'their', 'them', 'it',
    'this', 'that', 'about', 'one', 'record', 'records', 'entry', 'entries', 'row', 'rows', 'field', 'value', 'current',
    'first', 'second', 'third',
  ]);
    return OrchestratorListingUtils.splitFieldParts(message).filter((token) => token.length >= 2 && !stopWords.has(token));
  }

  static scoreFieldMatch(messageTokens: string[], fieldName: string, normalizedMessage: string): number {
    const fieldParts = OrchestratorListingUtils.splitFieldParts(fieldName);
    if (!fieldParts.length) return 0;
    const normalizedField = OrchestratorListingUtils.normalizeFieldToken(fieldName);
    let score = 0;
    if (normalizedField && new RegExp(`\\b${OrchestratorListingUtils.escapeRegExp(normalizedField)}\\b`).test(normalizedMessage)) {
    score += 6;
  }
  for (const token of messageTokens) {
    if (fieldParts.includes(token)) score += 3;
    else if (fieldParts.some((part) => part.startsWith(token) || token.startsWith(part))) score += 2;
    else if (normalizedField.includes(token) || token.includes(normalizedField)) score += 1;
  }
    return score;
  }

  static resolveRequestedFieldHint(
  message: string,
  availableFields: string[],
): { field: string; explicit: boolean; query: string } {
  const source = String(message || '').trim();
  if (!source) return { field: '', explicit: false, query: '' };
    const quoted = source.match(/["'`""'']([^"'`""'']{2,80})["'`""'']/);  
    if (quoted?.[1]) {
      const query = OrchestratorListingUtils.normalizeFieldToken(quoted[1]);
      const exact = availableFields.find((field) => OrchestratorListingUtils.normalizeFieldToken(field) === query) || '';
    return { field: exact, explicit: true, query };
  }
    const tokens = OrchestratorListingUtils.extractMeaningfulTokens(source);
    if (!tokens.length) return { field: '', explicit: false, query: '' };
    const normalizedMessage = OrchestratorListingUtils.normalizeFieldToken(source);
    const best = availableFields
      .map((field) => ({ field, score: OrchestratorListingUtils.scoreFieldMatch(tokens, field, normalizedMessage) }))
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 3) {
    return { field: best.field, explicit: true, query: tokens.join(' ') };
  }
  if (tokens.length === 1) {
    return { field: '', explicit: true, query: tokens[0] };
  }
    return { field: '', explicit: false, query: tokens.join(' ') };
  }

  static parseRecordIndexHint(message: string): number | undefined {
  const text = String(message || '').toLowerCase();
  if (/\b(first|1st|#1)\b/.test(text)) return 0;
  if (/\b(third|3rd|#3)\b/.test(text)) return 2;
  if (/\b(second|2nd|#2)\b/.test(text)) return 1;
    return undefined;
  }

  static extractRecordIdentity(record: any): string {
  if (!record || typeof record !== 'object') return '';
  const candidates = ['id', '_id', 'slug', 'email', 'name', 'title'];
  for (const key of candidates) {
    const value = (record as any)[key];
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return `${key}:${normalized}`;
  }
    return '';
  }

  static findRecordIndexByMention(message: string, docs: any[]): number | undefined {
  const text = String(message || '').toLowerCase();
  if (!text) return undefined;
  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i];
    if (!doc || typeof doc !== 'object') continue;
    const scalarPairs = Object.entries(doc).filter((entry) => {
      const value = entry[1];
      return value !== null && value !== undefined && typeof value !== 'object';
    });
    for (const [key, rawValue] of scalarPairs) {
      const value = String(rawValue || '').trim();
      if (!value) continue;
      const normalizedKey = OrchestratorListingUtils.normalizeFieldToken(String(key || ''));
      const normalizedValue = String(value).toLowerCase();
      if (!normalizedValue) continue;
      if (normalizedValue.length < 3 && !/\b(id|_id)\b/.test(normalizedKey)) continue;
      if (text.includes(normalizedValue)) return i;
    }
  }
    return undefined;
  }

  static resolveTargetRowIndex(message: string, docs: any[], listingMemory: NonNullable<AssistantSessionCheckpoint['memory']>['listing'] | null): number {
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


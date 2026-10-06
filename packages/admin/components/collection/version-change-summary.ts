import { CoercionUtils } from '@fromcode119/core/client';
import type { IVersionFieldChange } from '@/components/collection/interfaces/version-field-change.interface';

/**
 * What changed between two versions of a record.
 *
 * Every version stores the record as it was, but the history list only said "Update <table> record" —
 * nothing about WHAT was updated, so an operator could not tell two versions apart without restoring
 * one. The change is read by comparing a version with the one before it, field by field.
 */
export class VersionChangeSummary {
  /** Keys the platform maintains itself; a difference in them is not a change anyone made. */
  private static readonly SYSTEM_KEYS = new Set([
    'id', 'createdat', 'updatedat', 'tenantid', 'version', 'archivedat', 'archivedwith', 'updatedby', 'createdby',
  ]);

  /** The changes in `newer` against `older`, in field order; null when there is nothing earlier to compare with. */
  static between(newer: Record<string, unknown> | null, older: Record<string, unknown> | null, fields: any[]): IVersionFieldChange[] | null {
    if (!newer || !older) return null;
    const labels = VersionChangeSummary.labelsOf(fields);
    const before = VersionChangeSummary.canonical(older);
    const after = VersionChangeSummary.canonical(newer);
    const names = Array.from(new Set([...Object.keys(after), ...Object.keys(before)]));
    const changes: IVersionFieldChange[] = [];
    for (const name of names) {
      if (VersionChangeSummary.SYSTEM_KEYS.has(name.toLowerCase())) continue;
      const was = JSON.stringify(before[name] ?? null);
      const now = JSON.stringify(after[name] ?? null);
      if (was === now) continue;
      changes.push({ label: labels.get(name.toLowerCase()) ?? name, from: VersionChangeSummary.show(before[name]), to: VersionChangeSummary.show(after[name]) });
    }
    return changes;
  }

  /** camelCase and snake_case spell the same field the same way: `total_amount` and `totalAmount` are one. */
  private static canonical(record: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) out[key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())] = value;
    return out;
  }

  private static labelsOf(fields: any[]): Map<string, string> {
    const labels = new Map<string, string>();
    for (const field of CoercionUtils.toArray(fields) as any[]) {
      const name = CoercionUtils.toString(field?.name);
      if (name) labels.set(name.toLowerCase(), CoercionUtils.toString(field?.label) || name);
    }
    return labels;
  }

  private static show(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return `[${value.length}]`;
    if (value instanceof Date) return value.toISOString().slice(0, 16).replace('T', ' ');
    const text = Object(value) === value ? JSON.stringify(value) : String(value);
    return text.length > 40 ? `${text.slice(0, 39)}…` : text;
  }
}

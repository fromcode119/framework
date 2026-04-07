import type {
  PluginDefaultPageContractBackfillAssociationConflicts,
  PluginDefaultPageContractBackfillAssociationMaps,
  PluginDefaultPageContractBackfillAssociationRecord,
  PluginDefaultPageContractBackfillAssociationSnapshot,
} from '../../types';
import { BaseService } from '../base-service';

export class PluginDefaultPageBackfillAssociationService extends BaseService {
  get serviceName(): string {
    return 'PluginDefaultPageBackfillAssociationService';
  }

  createMaps(existingAssociations?: PluginDefaultPageContractBackfillAssociationSnapshot): PluginDefaultPageContractBackfillAssociationMaps {
    const byCanonicalKey = new Map<string, PluginDefaultPageContractBackfillAssociationRecord>();
    const byPageId = new Map<string, PluginDefaultPageContractBackfillAssociationRecord>();
    const conflicts: PluginDefaultPageContractBackfillAssociationConflicts = {
      canonicalKeys: new Set<string>(),
      pageIds: new Set<string>(),
    };

    for (const [canonicalKey, entry] of Object.entries(existingAssociations?.byCanonicalKey || {})) {
      const record = this.createAssociationRecord(canonicalKey, entry?.pageId, entry?.canonicalKey);

      if (!record) {
        continue;
      }

      this.setCanonicalMapRecord(byCanonicalKey, record, conflicts);
      this.setPageMapRecord(byPageId, record, conflicts);
    }

    for (const [pageId, entry] of Object.entries(existingAssociations?.byPageId || {})) {
      const record = this.createAssociationRecord(entry?.canonicalKey, entry?.pageId ?? pageId, entry?.canonicalKey);

      if (!record) {
        continue;
      }

      this.setCanonicalMapRecord(byCanonicalKey, record, conflicts);
      this.setPageMapRecord(byPageId, record, conflicts);
    }

    return {
      byCanonicalKey,
      byPageId,
      conflicts,
    };
  }

  private setCanonicalMapRecord(
    byCanonicalKey: Map<string, PluginDefaultPageContractBackfillAssociationRecord>,
    record: PluginDefaultPageContractBackfillAssociationRecord,
    conflicts: PluginDefaultPageContractBackfillAssociationConflicts,
  ): void {
    const existingRecord = byCanonicalKey.get(record.canonicalKey);

    if (!existingRecord) {
      byCanonicalKey.set(record.canonicalKey, record);
      return;
    }

    if (this.isSameAssociation(existingRecord, record)) {
      return;
    }

    conflicts.canonicalKeys.add(record.canonicalKey);
    conflicts.pageIds.add(String(existingRecord.pageId));
    conflicts.pageIds.add(String(record.pageId));
  }

  private setPageMapRecord(
    byPageId: Map<string, PluginDefaultPageContractBackfillAssociationRecord>,
    record: PluginDefaultPageContractBackfillAssociationRecord,
    conflicts: PluginDefaultPageContractBackfillAssociationConflicts,
  ): void {
    const pageIdKey = String(record.pageId);

    if (!byPageId.has(pageIdKey)) {
      byPageId.set(pageIdKey, record);
      return;
    }

    const existingRecord = byPageId.get(pageIdKey);

    if (!existingRecord || this.isSameAssociation(existingRecord, record)) {
      return;
    }

    conflicts.pageIds.add(pageIdKey);
    conflicts.canonicalKeys.add(existingRecord.canonicalKey);
    conflicts.canonicalKeys.add(record.canonicalKey);
  }

  private createAssociationRecord(
    fallbackCanonicalKey: string | undefined,
    pageId: number | string | undefined,
    canonicalKey: string | undefined,
  ): PluginDefaultPageContractBackfillAssociationRecord | undefined {
    const normalizedCanonicalKey = String(canonicalKey || fallbackCanonicalKey || '').trim();
    const normalizedPageId = this.normalizeOptionalIdentifier(pageId);

    if (!normalizedCanonicalKey || normalizedPageId === undefined) {
      return undefined;
    }

    return {
      canonicalKey: normalizedCanonicalKey,
      pageId: normalizedPageId,
    };
  }

  private normalizeOptionalIdentifier(value: number | string | undefined): number | string | undefined {
    if (typeof value === 'number') {
      return value;
    }

    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private isSameAssociation(
    left: PluginDefaultPageContractBackfillAssociationRecord,
    right: PluginDefaultPageContractBackfillAssociationRecord,
  ): boolean {
    return left.canonicalKey === right.canonicalKey && String(left.pageId) === String(right.pageId);
  }
}
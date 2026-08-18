import { McpSchema } from '@fromcode119/mcp';
import { CoercionUtils } from '@fromcode119/core/client';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import type { IAssistantCollectionContext } from '@ai/admin-assistant-runtime/interfaces/assistant-collection-context.interface';

/**
 * MCP tool definitions over the framework's record versions (`_system_record_versions`).
 *
 * The admin's Version History UI could already list and restore snapshots, but the MCP surface could
 * not — a remote operator had no way to inspect what a record held before a bad save. Version rows
 * come from the RAW db manager, so their canonical field names are snake_case (`version_data`,
 * `change_summary`); these tools map them to the camelCase wire shape in one place.
 */
export class McpVersionTools {
  static build(options: IAdminAssistantRuntimeOptions, _dryRun: boolean): IMcpToolDefinition[] {
    return [
      {
        tool: 'content.versions_list', readOnly: true,
        title: 'List record versions',
        permission: 'content:read',
        inputSchema: McpSchema.object({
          collectionSlug: McpSchema.string({ description: 'Collection slug.' }),
          id: McpSchema.string({ description: 'Record id whose history to list.' }),
          limit: McpSchema.number({ description: 'Versions to return, 1-50. Defaults to 20.' }),
          offset: McpSchema.number({ description: 'Versions to skip. Defaults to 0.' }),
        }, ['collectionSlug', 'id']),
        description: 'List the saved versions of one record, newest first. Fetch a snapshot with content.version_get.',
        handler: async (input) => {
          const collection = McpVersionTools.resolveCollection(options, input);
          if (typeof options.listRecordVersions !== 'function') throw new Error('content.versions_list is not available in this runtime.');
          const refId = McpVersionTools.resolveRefId(input);
          const limit = Math.min(50, Math.max(1, Number(input?.limit || 20)));
          const offset = Math.max(0, Number(input?.offset || 0));
          const result = await options.listRecordVersions(collection, refId, { limit, offset });
          const docs = Array.isArray(result?.docs) ? result.docs : [];
          return {
            collectionSlug: collection.slug,
            refId,
            versions: docs.map((row: any) => McpVersionTools.toVersionSummary(row)),
            totalDocs: Number(result?.totalDocs || docs.length),
            limit,
            offset,
          };
        },
      },
      {
        tool: 'content.version_get', readOnly: true,
        title: 'Read one record version',
        permission: 'content:read',
        inputSchema: McpSchema.object({
          collectionSlug: McpSchema.string({ description: 'Collection slug.' }),
          id: McpSchema.string({ description: 'Record id.' }),
          version: McpSchema.number({ description: 'Version number from content.versions_list.' }),
        }, ['collectionSlug', 'id', 'version']),
        description: 'Read one saved version of a record, including its full data snapshot.',
        handler: async (input) => {
          const collection = McpVersionTools.resolveCollection(options, input);
          if (typeof options.getRecordVersion !== 'function') throw new Error('content.version_get is not available in this runtime.');
          const refId = McpVersionTools.resolveRefId(input);
          const version = Number(input?.version);
          const row = await options.getRecordVersion(collection, refId, version);
          if (!row) return { collectionSlug: collection.slug, refId, version, found: false };
          return {
            collectionSlug: collection.slug,
            refId,
            found: true,
            ...McpVersionTools.toVersionSummary(row),
            versionData: McpVersionTools.parseVersionData(row),
          };
        },
      },
      {
        tool: 'content.version_restore', readOnly: false,
        title: 'Restore a record version',
        permission: 'content:write',
        inputSchema: McpSchema.object({
          collectionSlug: McpSchema.string({ description: 'Collection slug.' }),
          id: McpSchema.string({ description: 'Record id.' }),
          version: McpSchema.number({ description: 'Version number to restore. The FULL snapshot is applied, not single fields.' }),
        }, ['collectionSlug', 'id', 'version']),
        description: 'Restore a record to a saved version (applies the whole snapshot and records the restore as a new version).',
        handler: async (input, context) => {
          const collection = McpVersionTools.resolveCollection(options, input);
          if (typeof options.getRecordVersion !== 'function' || typeof options.restoreRecordVersion !== 'function') {
            throw new Error('content.version_restore is not available in this runtime.');
          }
          const refId = McpVersionTools.resolveRefId(input);
          const version = Number(input?.version);
          const row = await options.getRecordVersion(collection, refId, version);
          if (!row) throw new Error(`Version ${version} not found for "${collection.slug}" record ${refId}.`);
          const action = { type: 'mcp_call', tool: 'content.version_restore', input: { collectionSlug: collection.slug, id: refId, version } };
          if (context?.dryRun === true || _dryRun) {
            return { dryRun: true, action, ...McpVersionTools.toVersionSummary(row), versionData: McpVersionTools.parseVersionData(row) };
          }
          const item = await options.restoreRecordVersion(collection, refId, version);
          return { dryRun: false, action, restored: true, ...McpVersionTools.toVersionSummary(row), item };
        },
      },
    ];
  }

  private static resolveCollection(options: IAdminAssistantRuntimeOptions, input: any): IAssistantCollectionContext {
    const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
    const collection = options.findCollectionBySlug(collectionSlug);
    if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
    return collection;
  }

  private static resolveRefId(input: any): string {
    const refId = String(input?.id ?? input?.recordId ?? '').trim();
    if (!refId) throw new Error('Missing record id');
    return refId;
  }

  private static toVersionSummary(row: any): Record<string, unknown> {
    return {
      version: Number(row?.version) || 0,
      createdAt: CoercionUtils.toString(row?.created_at),
      updatedBy: CoercionUtils.toString(row?.updated_by),
      changeSummary: CoercionUtils.toString(row?.change_summary),
    };
  }

  private static parseVersionData(row: any): Record<string, unknown> {
    return CoercionUtils.toParsedObject(row?.version_data);
  }
}

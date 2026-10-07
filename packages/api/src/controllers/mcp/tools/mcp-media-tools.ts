import { McpSchema } from '@fromcode119/mcp';
import { IMcpToolDefinition } from '@fromcode119/mcp';
import { CoercionUtils, SystemConstants } from '@fromcode119/core';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';
import { MediaIngestService } from '@api/services/media-ingest-service';

/**
 * Media tools — the ones the 2026-08-15 vision-board job needed and could not reach. Storing goes
 * through `MediaIngestService`, the same guarded path plugins use; these tools add only the
 * operator-configured MCP size limit.
 *
 * `media.replace` deliberately writes to a NEW filename. The uploads path is served with
 * `cache-control: public, max-age=2592000`, so overwriting bytes under an existing name leaves the CDN
 * serving the old image for thirty days — which is exactly what happened during that job and cost the
 * morning. A fresh name sidesteps the edge cache entirely; the media record is repointed and the old
 * file is left to age out.
 */
export class McpMediaTools {
  static all(deps: IMcpToolDependencies): IMcpToolDefinition[] {
    return [
      {
        tool: 'media.list',
        title: 'List media',
        description: 'List media records, most recent first.',
        readOnly: true,
        permission: 'content:read',
        inputSchema: McpSchema.object({
          filename: McpSchema.string({ description: 'Return only records whose filename contains this text.' }),
          limit: McpSchema.number({ description: 'Records to return, 1-200. Defaults to 50.' }),
        }),
        handler: async (input: any = {}) => {
          const limit = Math.min(200, Math.max(1, CoercionUtils.toNumber(input.limit) || 50));
          const rows = await deps.db.find('media', { limit, orderBy: { id: 'desc' } });
          const needle = CoercionUtils.toKey(input.filename);
          const items = (Array.isArray(rows) ? rows : [])
            .filter((row: any) => !needle || String(row?.filename || '').toLowerCase().includes(needle))
            .map((row: any) => ({
              id: row.id,
              filename: row.filename,
              path: row.path,
              // The USABLE address — what a slot-setting tool or a content field takes. Private media
              // has no public URL, so it reports null rather than a link that would 404.
              url: row.visibility === 'private' ? null : (deps.mediaManager.publicUrl(String(row.path || '')) || null),
              alt: row.alt ?? null,
              width: row.width ?? null,
              height: row.height ?? null,
              fileSize: row.fileSize ?? null,
            }));
          return { items, count: items.length };
        },
      },
      {
        tool: 'media.upload',
        title: 'Upload media',
        description: 'Upload an image from base64 content or a source URL, and register it as media.',
        readOnly: false,
        permission: 'content:write',
        inputSchema: McpSchema.object({
          filename: McpSchema.string({ description: 'Target filename including extension, e.g. "hero.jpg".' }),
          base64: McpSchema.string({ description: 'File content, base64 encoded. Supply this or sourceUrl.' }),
          sourceUrl: McpSchema.string({ description: 'URL to fetch the file from. Supply this or base64.' }),
          alt: McpSchema.string({ description: 'Alt text stored on the media record.' }),
        }, ['filename']),
        handler: async (input: any = {}) => McpMediaTools.store(deps, input, null),
      },
      {
        tool: 'media.replace',
        title: 'Replace media content',
        description: 'Point an existing media record at new bytes, under a NEW filename so caches cannot serve the old image.',
        readOnly: false,
        permission: 'content:write',
        inputSchema: McpSchema.object({
          id: McpSchema.number({ description: 'Media record id to repoint.' }),
          base64: McpSchema.string({ description: 'New file content, base64 encoded. Supply this or sourceUrl.' }),
          sourceUrl: McpSchema.string({ description: 'URL to fetch the new content from.' }),
        }, ['id']),
        handler: async (input: any = {}) => {
          const id = CoercionUtils.toNumber(input.id);
          if (!id) throw new Error('media.replace requires a media record id.');
          const existing = await deps.db.findOne('media', { id });
          if (!existing) throw new Error(`No media record ${id}.`);
          return McpMediaTools.store(deps, { ...input, filename: String(existing.filename || 'file') }, existing);
        },
      },
    ];
  }

  /** Fetch or decode the bytes, store them, generate the webp variant, and write the media row. */
  private static async store(deps: IMcpToolDependencies, input: any, existing: any): Promise<any> {
    return new MediaIngestService(deps.db, deps.mediaManager).ingest(input, McpMediaTools.maxBytes(deps), existing);
  }

  private static async readBytes(deps: IMcpToolDependencies, input: any): Promise<Buffer> {
    return MediaIngestService.readBytes(input, McpMediaTools.maxBytes(deps));
  }

  private static async fetchRemoteBytes(deps: IMcpToolDependencies, sourceUrl: string): Promise<Buffer> {
    return MediaIngestService.fetchRemoteBytes(sourceUrl, McpMediaTools.maxBytes(deps));
  }

  private static maxMegabytes(deps: IMcpToolDependencies): number {
    const configured = Number(deps.settingsCache.get(SystemConstants.META_KEY.MCP_REMOTE_MEDIA_MAX_MB));
    if (!Number.isFinite(configured) || configured <= 0) {
      throw new Error('MCP remote media limit is missing or invalid in Settings → Integrations → MCP.');
    }
    return configured;
  }

  private static maxBytes(deps: IMcpToolDependencies): number {
    return Math.floor(McpMediaTools.maxMegabytes(deps) * 1024 * 1024);
  }
}

import { randomUUID } from 'crypto';
import { McpSchema } from '@fromcode119/mcp';
import { IMcpToolDefinition } from '@fromcode119/mcp';
import { CoercionUtils } from '@fromcode119/core';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';

/**
 * Media tools — the ones the 2026-08-15 vision-board job needed and could not reach.
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
          const needle = CoercionUtils.toString(input.filename).trim().toLowerCase();
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
    const bytes = await McpMediaTools.readBytes(input);
    const filename = McpMediaTools.uniqueFilename(CoercionUtils.toString(input.filename));

    const stored = await deps.mediaManager.upload(bytes, filename);
    const optimized = await deps.mediaManager
      .createWebPVariant(stored.path)
      .catch(() => null);

    const record = {
      filename,
      originalName: CoercionUtils.toString(input.filename) || filename,
      mimeType: stored.mimeType,
      fileSize: stored.size,
      width: stored.width ?? null,
      height: stored.height ?? null,
      path: stored.path,
      alt: CoercionUtils.toString(input.alt) || existing?.alt || null,
      optimizedPath: optimized?.path ?? null,
      optimizedSize: optimized?.size ?? null,
      optimizedWidth: optimized?.width ?? null,
      optimizedHeight: optimized?.height ?? null,
    };

    // STRING table name, never the drizzle Schema.media object: the drizzle table's `defaultNow()`
    // compiles to Postgres `now()`, which SQLite does not have — the string path routes through the
    // dialect, which owns the timestamps on both databases (same as MediaController).
    // `url` is part of the tool's OUTPUT, not the DB record — it is the address the next tool call
    // (a slot-setting tool, a content field) actually needs; returning only the storage path made the
    // upload result unusable without a second lookup.
    const urls = { url: stored.url || deps.mediaManager.publicUrl(stored.path) || null, optimizedUrl: optimized?.url ?? null };
    if (existing) {
      await deps.db.update('media', { id: existing.id }, record);
      return { id: existing.id, replaced: true, ...record, ...urls };
    }
    const inserted = await deps.db.insert('media', record);
    return { id: inserted?.id ?? inserted?.[0]?.id ?? null, replaced: false, ...record, ...urls };
  }

  private static async readBytes(input: any): Promise<Buffer> {
    const base64 = CoercionUtils.toString(input.base64);
    if (base64) return Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');

    const sourceUrl = CoercionUtils.toString(input.sourceUrl);
    if (!sourceUrl) throw new Error('Supply either base64 or sourceUrl.');
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Could not fetch ${sourceUrl} (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Always a fresh name. See the class comment: reusing a filename means a 30-day CDN cache keeps
   * serving the previous bytes, and the change looks like it silently did nothing.
   */
  private static uniqueFilename(requested: string): string {
    const clean = requested.trim() || 'file';
    const dot = clean.lastIndexOf('.');
    const stem = dot > 0 ? clean.slice(0, dot) : clean;
    const ext = dot > 0 ? clean.slice(dot) : '';
    return `${stem}-${randomUUID()}${ext}`;
  }
}

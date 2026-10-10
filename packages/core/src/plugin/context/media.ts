import * as crypto from 'crypto';
import { NamingStrategy } from '@fromcode119/database';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { MediaIngestBridge } from '@core/plugin/media-ingest-bridge';
import type { IPluginMediaIngestInput } from '@core/plugin/interfaces/plugin-media-ingest-input.interface';
import type { ContextSecurityProxy } from '@core/plugin/context/utils';

export class MediaContextProxy {
  /** Never resolve more than this many ids in one statement, so one call cannot become an unbounded IN list. */
  private static readonly MAX_BATCH = 500;
  /** The largest file `read` hands over: the admin upload limit, so any file a site could upload can be read back. */
  static readonly MAX_READ_BYTES = 25 * 1024 * 1024;
  /** The longest description `describe` stores. */
  private static readonly MAX_ALT_LENGTH = 500;

  /**
   * Rows leave here in the SAME shape as `context.db` rows: camelCase, one canonical name per field.
   *
   * The raw manager returns the physical snake_case columns, so plugins reading `originalName` got
   * `undefined` and had to reach for `original_name` — the dual-spelling read this codebase forbids,
   * forced on them by the framework leaking its own internals across the boundary.
   */
  private static denormalize(row: any): Record<string, any> | null {
    return row ? NamingStrategy.denormalizeRecord(row) : null;
  }

  /**
   * Media proxy for plugins — reads, plus `ingest` and `describe`. Plugins must NOT query the `media` system table via context.db
   * (that path is blocked) — they resolve a media item through here. Uses the RAW manager db so the
   * framework owns the only access to the system table.
   *
   * The raw db is not an isolation hole: under tenancy the `media` table carries row-level security
   * (a bespoke policy, because media also admits shared assets — see `TenantScopedTables`), and the
   * app connects as a non-superuser role, so the tenant filter is enforced by the CONNECTION and
   * applies to every statement here. A plugin cannot resolve another tenant's media by guessing an id.
   */
  static createMediaProxy(manager: IPluginManagerInterface, security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>) {
    return {
      /**
       * Store a file from a public url or base64 bytes as a media record, and return it (with its
       * `id` and public `url`). The ONE write this surface has: a plugin never touches the `media`
       * table, so the file goes through the api's own ingest — the same address checks, size cap,
       * type check and webp variant every other upload gets. Needs the `content` capability.
       */
      async ingest(input: IPluginMediaIngestInput): Promise<Record<string, unknown>> {
        if (!security.hasCapability('content')) security.handleViolation('content');
        return MediaIngestBridge.ingest(input);
      },
      /**
       * A second, narrow write: a file's description (`alt`) only, trimmed and capped. The row is the
       * site's own — the connection's tenant filter applies — so an id of another site matches nothing.
       */
      async describe(id: any, input: { alt: string }): Promise<boolean> {
        if (!security.hasCapability('content')) security.handleViolation('content');
        const alt = String(input?.alt ?? '').trim().slice(0, MediaContextProxy.MAX_ALT_LENGTH);
        if (id == null || id === '' || !alt) return false;
        const row = await manager.db.findOne(SystemConstants.TABLE.MEDIA, { id });
        if (!row) return false;
        // Already so described: nothing to write (a re-import names thousands of files it named before).
        if (String((row as any).alt ?? '') === alt) return true;
        await manager.db.update(SystemConstants.TABLE.MEDIA, { id }, { alt });
        return true;
      },
      async findById(id: any): Promise<Record<string, any> | null> {
        if (id == null || id === '') return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.MEDIA, { id });
        return MediaContextProxy.denormalize(row);
      },
      /**
       * Resolve MANY ids in one statement, keyed by id.
       *
       * Without this, a list of N records each carrying a media reference costs N round trips — the
       * documents list was doing exactly that, one `findById` per row inside the render loop. The
       * result is a map rather than an array because the caller is joining it onto rows it already
       * has, and because a missing or unreadable id must be an absent key, not a silent shift in
       * position.
       */
      async findByIds(ids: any[]): Promise<Map<string, Record<string, any>>> {
        const unique = Array.from(new Set((ids || []).filter((id) => id != null && id !== '').map(String)));
        const resolved = new Map<string, Record<string, any>>();
        if (unique.length === 0) return resolved;

        for (let start = 0; start < unique.length; start += MediaContextProxy.MAX_BATCH) {
          const batch = unique.slice(start, start + MediaContextProxy.MAX_BATCH);
          const rows = await manager.db.find(SystemConstants.TABLE.MEDIA, {
            where: { id: { in: batch } },
            limit: batch.length,
          });
          for (const row of Array.isArray(rows) ? rows : []) {
            const record = MediaContextProxy.denormalize(row);
            if (record?.id != null) resolved.set(String(record.id), record);
          }
        }
        return resolved;
      },
      /**
       * List media records (newest first). The sanctioned way for plugins (e.g. a media
       * library) to enumerate media — they must NOT query the `media` system table via context.db.
       */
      async list(options?: { limit?: number; offset?: number }): Promise<Array<Record<string, any>>> {
        const limit = Math.max(1, Math.min(Number(options?.limit) || 50, MediaContextProxy.MAX_BATCH));
        const findOptions: Record<string, any> = { limit, orderBy: { createdAt: 'desc' } };
        const offset = Number(options?.offset) || 0;
        if (offset > 0) findOptions.offset = offset;
        const rows = await manager.db.find(SystemConstants.TABLE.MEDIA, findOptions);
        return (Array.isArray(rows) ? rows : []).map((row) => MediaContextProxy.denormalize(row) as Record<string, any>);
      },
      /** Count media records — sanctioned alternative to a blocked `context.db.count('media')`. */
      async count(): Promise<number> {
        const total = await manager.db.count(SystemConstants.TABLE.MEDIA, {});
        return Number(total) || 0;
      },
      /**
       * The address a browser or another installation fetches a stored file from, or null when the id
       * resolves to nothing here or the file is private (only the public space is served).
       *
       * A media row stores a path, not a URL — the URL belongs to the storage driver (local uploads, a
       * bucket, a CDN). Without this a plugin that hands a file out had to hardcode where the driver
       * happens to serve it.
       */
      async publicUrl(id: any): Promise<string | null> {
        if (id == null || id === '') return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.MEDIA, { id });
        if (!row?.path) return null;
        const url = (manager.integrations as any).storage.publicUrl(String(row.path), String(row.visibility || 'public'));
        return url ? String(url) : null;
      },
      /**
       * SHA-256 (hex) of a stored file's bytes, or null when the id resolves to nothing.
       *
       * A plugin runs isolated and cannot open the storage itself, so a plugin that has to publish a
       * checksum for a file it hands out (a package catalogue) had no way to compute one. The row is
       * resolved through the same tenant-scoped read as `findById`, so an id from another site yields
       * null, and the bytes are streamed rather than buffered.
       */
      async digest(id: any): Promise<string | null> {
        if (id == null || id === '') return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.MEDIA, { id });
        if (!row?.path) return null;
        const storage = (manager.integrations as any).storage;
        const stream: NodeJS.ReadableStream = await storage.stream(String(row.path), String(row.visibility || 'public'));
        const hash = crypto.createHash('sha256');
        for await (const chunk of stream as AsyncIterable<Buffer | string>) hash.update(chunk);
        return hash.digest('hex');
      },
      /**
       * A stored file's bytes (base64), with its name and type, or null when the id resolves to nothing
       * in this site or the file is larger than {@link MediaContextProxy.MAX_READ_BYTES}.
       *
       * A plugin that hands a site's files out — a migration package, a backup, an export — had no way
       * to read them: it runs isolated and cannot open the storage. Same tenant-scoped row as `digest`,
       * so another site's id yields null; base64 because the bytes cross the sandbox boundary.
       */
      async read(id: any): Promise<{ filename: string; mimeType: string; size: number; base64: string } | null> {
        if (id == null || id === '') return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.MEDIA, { id });
        if (!row?.path) return null;
        const storage = (manager.integrations as any).storage;
        const stream: NodeJS.ReadableStream = await storage.stream(String(row.path), String(row.visibility || 'public'));
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of stream as AsyncIterable<Buffer | string>) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.length;
          if (size > MediaContextProxy.MAX_READ_BYTES) {
            (stream as any).destroy?.();
            return null;
          }
          chunks.push(bytes);
        }
        const media = MediaContextProxy.denormalize(row) as Record<string, any>;
        return {
          filename: String(media.originalName || media.filename || row.path),
          mimeType: String(media.mimeType || 'application/octet-stream'),
          size,
          base64: Buffer.concat(chunks, size).toString('base64'),
        };
      }
    };
  }
}

import type { IDatabaseManager } from '@fromcode119/database';
import { CoreServices } from '@core/services/core-services';
import type { RedirectResolution } from '@core/services/redirect-resolution';

/**
 * The framework's own URL-redirect rules — ONE store (`_system_redirects`), one admin surface
 * (Settings → Redirects), consulted through the same plugin-agnostic registry every other resolver
 * uses. This replaced two per-plugin copies of the identical capability (cms + seo), which raced each
 * other by boot order; their rows were migrated in by `SystemRedirectsMigration`.
 *
 * Framework internals access the DB through the raw manager, so columns are snake_case here and rows
 * are mapped to camelCase at the edge — the API/admin never see a snake key.
 *
 * `lookup` runs on would-be-404 requests only (the resolution layer asks the registry AFTER content
 * resolution fails), so a rule can never shadow a live page. Hit counting is fire-and-forget.
 */
export class SystemRedirectService {
  private static readonly TABLE = '_system_redirects';
  private static readonly LIST_MAX = 1000;

  constructor(private readonly db: IDatabaseManager) {}

  /** Boot wiring: the framework consults its own store via its own registry, keyed 'system'. */
  static register(db: IDatabaseManager): SystemRedirectService {
    const service = new SystemRedirectService(db);
    CoreServices.getInstance().redirectResolvers.register('system', (path: string) => service.lookup(path));
    return service;
  }

  async lookup(path: string): Promise<RedirectResolution | null> {
    const fromPath = SystemRedirectService.normalizePath(path);
    if (!fromPath) return null;
    const row = (await this.db.findOne(SystemRedirectService.TABLE, { from_path: fromPath })) as Record<string, unknown> | null;
    if (!row || !SystemRedirectService.isEnabled(row.enabled)) return null;
    const target = String(row.to_path ?? '').trim();
    if (!target) return null;
    void this.recordHit(row);
    return { target, permanent: String(row.type ?? '301') !== '302' };
  }

  async list(): Promise<Record<string, unknown>[]> {
    const rows = (await this.db.find(SystemRedirectService.TABLE, {
      limit: SystemRedirectService.LIST_MAX,
      orderBy: { created_at: 'desc' },
    })) as Record<string, unknown>[];
    return rows.map((row) => SystemRedirectService.mapRow(row));
  }

  async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data = SystemRedirectService.normalizeInput(input);
    if (!data.from_path) throw new Error('A redirect needs a From path starting with /.');
    if (!data.to_path) throw new Error('A redirect needs a To path or URL.');
    const existing = await this.db.findOne(SystemRedirectService.TABLE, { from_path: data.from_path });
    if (existing) throw new Error(`A redirect from "${data.from_path}" already exists.`);
    const row = await this.db.insert(SystemRedirectService.TABLE, { ...data, hit_count: 0 });
    return SystemRedirectService.mapRow(row as Record<string, unknown>);
  }

  async update(id: number, input: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!Number.isFinite(id) || id <= 0) return null;
    const patch = SystemRedirectService.normalizeInput(input, { partial: true });
    if (!Object.keys(patch).length) return null;
    const row = await this.db.update(
      SystemRedirectService.TABLE,
      { id },
      { ...patch, updated_at: new Date().toISOString() },
    );
    return row ? SystemRedirectService.mapRow(row as Record<string, unknown>) : null;
  }

  async remove(id: number): Promise<boolean> {
    if (!Number.isFinite(id) || id <= 0) return false;
    await this.db.delete(SystemRedirectService.TABLE, { id });
    return true;
  }

  private async recordHit(row: Record<string, unknown>): Promise<void> {
    try {
      const nextCount = (Number(row.hit_count ?? 0) || 0) + 1;
      await this.db.update(SystemRedirectService.TABLE, { id: row.id }, { hit_count: nextCount });
    } catch {
      // A lost hit increment must never affect the redirect itself.
    }
  }

  /**
   * camelCase edge shape. `enabled` leaves as a real boolean — the loose flags the cms table stored
   * (`1.0`, `'true'`) are normalized here so no consumer re-implements the coercion.
   */
  private static mapRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: Number(row.id ?? 0) || 0,
      fromPath: String(row.from_path ?? ''),
      toPath: String(row.to_path ?? ''),
      type: String(row.type ?? '301') === '302' ? '302' : '301',
      enabled: SystemRedirectService.isEnabled(row.enabled),
      hitCount: Number(row.hit_count ?? 0) || 0,
      notes: String(row.notes ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
  }

  private static normalizeInput(input: Record<string, unknown>, options?: { partial: boolean }): Record<string, unknown> {
    const partial = Boolean(options?.partial);
    const data: Record<string, unknown> = {};
    const setIf = (present: boolean, key: string, value: unknown) => {
      if (present || !partial) data[key] = value;
    };
    setIf(input.fromPath !== undefined, 'from_path', SystemRedirectService.normalizePath(input.fromPath));
    setIf(input.toPath !== undefined, 'to_path', String(input.toPath ?? '').trim());
    setIf(input.type !== undefined, 'type', String(input.type ?? '301') === '302' ? '302' : '301');
    setIf(input.enabled !== undefined, 'enabled', SystemRedirectService.isEnabled(input.enabled ?? true) ? 1 : 0);
    setIf(input.notes !== undefined, 'notes', String(input.notes ?? ''));
    return data;
  }

  /** `/a/b` for any reasonable operator input; `''` for anything that is not a site path. */
  private static normalizePath(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw || raw.startsWith('//') || raw.includes('\\')) return '';
    const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
    const withoutQuery = withSlash.split('#')[0].split('?')[0];
    const trimmed = withoutQuery.replace(/\/+$/, '');
    return trimmed || '/';
  }

  private static isEnabled(value: unknown): boolean {
    const raw = String(value ?? '').trim().toLowerCase();
    return !(raw === '' || raw === '0' || raw === '0.0' || raw === 'false' || raw === 'no');
  }
}

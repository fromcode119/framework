import { TenantState } from '@core/enums/tenant-state.enum';

/**
 * One tenant's answer to "which theme, with which variables" — read from `_system_tenant_themes`.
 *
 * A data class rather than a shape so the "no theme" case is a value with behaviour, not a null the
 * twenty call sites each interpret. `activeSlug === null` means the tenant renders with NO theme, and
 * the storefront says so in its log — it never inherits another tenant's or the platform's choice.
 *
 * Rows come through the RAW manager, so snake_case column names.
 */
export class TenantThemeChoice {
  readonly activeSlug: string | null;

  /** The tenant's variable overrides for the active theme. Null = the theme's own defaults. */
  readonly config: Record<string, unknown> | null;

  private constructor(activeSlug: string | null, config: Record<string, unknown> | null) {
    this.activeSlug = activeSlug;
    this.config = config;
  }

  static none(): TenantThemeChoice {
    return new TenantThemeChoice(null, null);
  }

  /** From the tenant's rows. At most one is active; the writer keeps that invariant. */
  static fromRows(rows: unknown[]): TenantThemeChoice {
    const active = (rows ?? []).find((row: any) => String(row?.state ?? '').trim() === TenantState.ACTIVE.value) as any;
    if (!active) return TenantThemeChoice.none();
    const slug = String(active.theme_slug ?? '').trim();
    if (!slug) return TenantThemeChoice.none();
    return new TenantThemeChoice(slug, TenantThemeChoice.parseConfig(active.config));
  }

  get hasTheme(): boolean {
    return this.activeSlug !== null;
  }

  /** `config` arrives as jsonb (object) on Postgres and as a string on SQLite; accept both, invent nothing. */
  private static parseConfig(raw: unknown): Record<string, unknown> | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

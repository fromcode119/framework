import { RestoreTargetKind } from '@core/management/enums/restore-target-kind.enum';

/**
 * What a restore writes over: the whole system, or one plugin/theme by slug.
 *
 * Replaces the `'system' | \`plugin:${string}\` | \`theme:${string}\`` union. The wire format is
 * unchanged — `parse()` reads it and `toString()` writes it — but the KIND and the SLUG are now separate
 * fields, so no consumer re-implements `startsWith('plugin:')` + `slice(…)` to get at them.
 */
export class RestoreTarget {
  private constructor(readonly kind: RestoreTargetKind, readonly slug: string | null) {}

  static readonly system = new RestoreTarget(RestoreTargetKind.SYSTEM, null);

  static plugin(slug: string): RestoreTarget {
    return new RestoreTarget(RestoreTargetKind.PLUGIN, slug);
  }

  static theme(slug: string): RestoreTarget {
    return new RestoreTarget(RestoreTargetKind.THEME, slug);
  }

  /**
   * Read the wire form (`system`, `plugin:<slug>`, `theme:<slug>`).
   * Returns null when the kind is unknown or a slug-bearing kind carries no slug.
   */
  static parse(raw: unknown): RestoreTarget | null {
    const text = String(raw ?? '').trim();
    const separator = text.indexOf(':');
    const kind = RestoreTargetKind.resolve(separator === -1 ? text : text.slice(0, separator));
    if (!kind) return null;
    if (!kind.requiresSlug) return RestoreTarget.system;
    const slug = separator === -1 ? '' : text.slice(separator + 1).trim();
    return slug ? new RestoreTarget(kind, slug) : null;
  }

  /** Human label for a message or a UI row. */
  get label(): string {
    if (!this.slug) return 'System';
    return `${this.kind.value.charAt(0).toUpperCase()}${this.kind.value.slice(1)} ${this.slug}`;
  }

  /** The wire form, unchanged from the union it replaced — so persisted values still round-trip. */
  toString(): string {
    return this.slug ? `${this.kind.value}:${this.slug}` : this.kind.value;
  }

  toJSON(): string {
    return this.toString();
  }
}

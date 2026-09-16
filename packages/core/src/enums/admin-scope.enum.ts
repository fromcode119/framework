import { Enum } from '@fromcode119/react-class-components';

/**
 * WHERE the admin is standing: on one site, or outside every site.
 *
 * Not the same axis as who the account is — a platform administrator has this scope too, and which
 * one they are in decides what the screens may show and write. Not {@link SettingScope} either: that
 * says who a SETTING's value is for, a property of the key. This says what the current request is.
 *
 * Stamped onto `/system/admin/metadata` and `/admin/stats/installation`, and read back by the admin,
 * so both ends name the same two values in one place instead of comparing string literals.
 *
 * There is deliberately no third member for "unknown" and no default: a payload that carries no scope
 * has not told us, and {@link resolve} answers `undefined` so the caller can say so rather than
 * picking one. Presenting a site as the platform, or the reverse, is the whole defect this names.
 */
export class AdminScope extends Enum {
  /** Outside every site — the platform's own screens, and the whole container's figures. */
  static readonly PLATFORM = new AdminScope('platform');
  /** Inside one site. Everything on screen is that site's, and nothing else's. */
  static readonly SITE = new AdminScope('site');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Resolve a raw string to a member, or `undefined` when it names none.
   *
   * The value crosses a JSON boundary, so the admin receives a plain string. Comparing that string to
   * a member is silently always false — the trap this enum exists to remove — so it is resolved once,
   * here, and compared as a member everywhere after.
   */
  static resolve(value: unknown): AdminScope | undefined {
    if (value instanceof AdminScope) return value;
    return AdminScope.fromValue(String(value ?? '').trim().toLowerCase()) as AdminScope | undefined;
  }

  get isSite(): boolean {
    return this === AdminScope.SITE;
  }

  get isPlatform(): boolean {
    return this === AdminScope.PLATFORM;
  }
}

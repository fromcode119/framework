import { Enum } from '@fromcode119/reactor';

/** Cookie `SameSite` attribute. */
export class CookieSameSite extends Enum {
  static readonly LAX = new CookieSameSite('lax');
  static readonly STRICT = new CookieSameSite('strict');
  static readonly NONE = new CookieSameSite('none');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to LAX. */
  static resolve(value: unknown): CookieSameSite {
    if (value instanceof CookieSameSite) return value;
    const found = CookieSameSite.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as CookieSameSite | undefined) ?? CookieSameSite.LAX;
  }
}

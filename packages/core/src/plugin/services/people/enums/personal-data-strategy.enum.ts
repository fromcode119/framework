import { Enum } from '@fromcode119/react-class-components';

/**
 * HOW a dataset honours an erasure request.
 *
 * There is no single right answer, which is why this is a choice and not a constant. A cookie
 * consent row should simply go. An invoice usually may not — accounting law commonly mandates years
 * of retention — and an audit row must survive as the security record while losing the identifiers
 * that make it personal data. A platform that hardcoded one of these would be wrong on every
 * deployment that needed another.
 *
 * Each dataset DECLARES which of these it can honestly honour; the operator CHOOSES among those,
 * per dataset, per site. One list, because three had started: the erasure service held its own
 * constants, the registry validated descriptors against a second array, and a plugin
 * resolved operator choices against a third — and a strategy added to one and not the others is a
 * dataset declaring something nothing can run.
 */
export class PersonalDataStrategy extends Enum {
  /** The rows go. Nothing of the subject survives in this dataset. */
  static readonly DELETE = new PersonalDataStrategy('delete');
  /**
   * The rows survive; the identifiers do not. For a dataset whose SHAPE is the record — an audit
   * trail, an order's financial totals — where destroying the row would destroy something other
   * than personal data.
   */
  static readonly ANONYMISE = new PersonalDataStrategy('anonymise');
  /**
   * The rows are kept, and the operator states the law that requires it. A retention with no stated
   * basis is refused rather than applied: it is indistinguishable from doing nothing, and the basis
   * is the one thing the subject is entitled to be told.
   */
  static readonly RETAIN = new PersonalDataStrategy('retain');

  private constructor(value: string) {
    super(value);
  }

  /**
   * The strategy named by an untrusted value, as its plain string, or `''` when this platform has no
   * such strategy.
   *
   * Stored choices and request bodies are `unknown`, and a plain string is what crosses the channel
   * to an isolated plugin and lands in a descriptor's `strategies`, so the normalising and the
   * unwrapping belong here rather than repeated at every call site.
   */
  static resolveValue(input: unknown): string {
    return PersonalDataStrategy.fromValue(String(input ?? '').trim().toLowerCase())?.value ?? '';
  }
}

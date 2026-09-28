/**
 * What counts as a contact detail on a page. Deliberately CONSERVATIVE: a miss stays in the page exactly
 * as it was; a false hit would only be hidden and put back, but a pattern loose enough to catch every local
 * phone format would catch prices, dates, order numbers and company IDs with it.
 *
 * - An email address, anywhere.
 * - A phone number in international form: `+`, then 8–15 digits, optionally grouped by spaces, dots,
 *   dashes or brackets (`+359 88 123 4567`, `+61 (2) 9999-9999`). A number in local form is protected
 *   when it is the target or the text of a `tel:` link, which says unambiguously what it is.
 */
export class ContactPatterns {
  private static readonly EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
  private static readonly PHONE = /\+\d[\d .()-]{6,22}\d/;
  private static readonly TEL_TARGET = /^\s*tel:/i;
  private static readonly MIN_PHONE_DIGITS = 8;
  private static readonly MAX_PHONE_DIGITS = 15;

  /** Emails and international phone numbers, for running text and attribute values. */
  static details(): RegExp {
    return new RegExp(`${ContactPatterns.EMAIL.source}|${ContactPatterns.PHONE.source}`, 'g');
  }

  static emails(): RegExp {
    return new RegExp(ContactPatterns.EMAIL.source, 'g');
  }

  static phones(): RegExp {
    return new RegExp(ContactPatterns.PHONE.source, 'g');
  }

  /** A candidate the PHONE shape matched is a phone only with a plausible number of digits. */
  static isPhone(candidate: string): boolean {
    const digits = candidate.replace(/\D/g, '').length;
    return digits >= ContactPatterns.MIN_PHONE_DIGITS && digits <= ContactPatterns.MAX_PHONE_DIGITS;
  }

  /** A match of `details()`: an email (it has the `@`), or a phone with a plausible digit count. */
  static isDetail(candidate: string): boolean {
    return candidate.includes('@') || ContactPatterns.isPhone(candidate);
  }

  static isTelTarget(value: string): boolean {
    return ContactPatterns.TEL_TARGET.test(value);
  }

  /** Whether a value holds anything worth protecting. */
  static contains(value: string): boolean {
    if (!value) return false;
    if (ContactPatterns.isTelTarget(value)) return true;
    for (const match of value.matchAll(ContactPatterns.details())) {
      if (ContactPatterns.isDetail(match[0])) return true;
    }
    return false;
  }
}

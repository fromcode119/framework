/**
 * A phone number a text can be sent to: international (E.164) form, `+` then 8 to 15 digits.
 *
 * Only that form is accepted. Turning a local number into an international one needs the country it
 * was written in, and guessing it would send someone's messages to a stranger abroad; the person types
 * their number with its country code once, when they agree to texts.
 */
export class PhoneNumber {
  private static readonly E164 = /^\+[1-9]\d{7,14}$/;

  /** The number in E.164 form, with spaces, dashes, dots and brackets removed — or '' when it is not one. */
  static normalize(value: unknown): string {
    const compact = String(value ?? '').trim().replace(/[\s().-]/g, '').replace(/^00/, '+');
    return PhoneNumber.E164.test(compact) ? compact : '';
  }
}

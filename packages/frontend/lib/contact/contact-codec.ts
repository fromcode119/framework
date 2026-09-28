/**
 * The reversible encoding behind the storefront's contact-detail protection, shared by the server pass that
 * takes email addresses and phone numbers out of the HTML and the browser step that puts them back before
 * hydration.
 *
 * DETERMINISTIC on purpose: the key is derived from the value, so the same value always encodes the same
 * way — a cached document and a fresh one are byte-identical, and nothing depends on a random draw.
 *
 * Format: two hex digits of key, then each UTF-16 code unit XOR-ed with it, four hex digits apiece.
 */
export class ContactCodec {
  static encode(value: string): string {
    const text = String(value ?? '');
    const key = ContactCodec.keyFor(text);
    let out = key.toString(16).padStart(2, '0');
    for (let index = 0; index < text.length; index += 1) {
      out += (text.charCodeAt(index) ^ key).toString(16).padStart(4, '0');
    }
    return out;
  }

  /** '' for anything that is not a well-formed encoding — never a partial or garbled value. */
  static decode(encoded: string): string {
    const value = String(encoded ?? '');
    if (value.length < 2 || (value.length - 2) % 4 !== 0 || !/^[0-9a-f]+$/i.test(value)) return '';
    const key = parseInt(value.slice(0, 2), 16);
    let out = '';
    for (let index = 2; index < value.length; index += 4) {
      out += String.fromCharCode(parseInt(value.slice(index, index + 4), 16) ^ key);
    }
    return out;
  }

  /** The value with its characters in reverse order — set right on screen by `<bdo dir="rtl">`. */
  static reversed(value: string): string {
    return Array.from(String(value ?? '')).reverse().join('');
  }

  /** 1..255, from the value itself. */
  private static keyFor(value: string): number {
    let sum = 0;
    for (let index = 0; index < value.length; index += 1) sum = (sum * 31 + value.charCodeAt(index)) % 255;
    return sum + 1;
  }
}

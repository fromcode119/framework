/**
 * The reversible encoding behind `ProtectedEmail`: an address kept out of the page's text, so a harvester
 * reading the HTML finds no address, while the browser can restore it.
 *
 * Deliberately DETERMINISTIC. The server render and the browser's first render must produce the same
 * markup or hydration fails — which is exactly why an edge rewrite of the HTML (a CDN's email
 * obfuscation) breaks a server-rendered page. So the key is derived from the address itself instead of
 * drawn at random: the same address always encodes to the same string, on both sides.
 *
 * Format: two hex digits of key, then each UTF-16 code unit XOR-ed with it, four hex digits apiece.
 */
export class EmailAddressCipher {
  /** A plain email address inside running text. Conservative on purpose: a miss stays readable text. */
  static readonly ADDRESS_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

  static encode(address: string): string {
    const value = String(address ?? '');
    const key = EmailAddressCipher.keyFor(value);
    let out = key.toString(16).padStart(2, '0');
    for (let index = 0; index < value.length; index += 1) {
      out += (value.charCodeAt(index) ^ key).toString(16).padStart(4, '0');
    }
    return out;
  }

  /** '' for anything that is not a well-formed encoding — never a partial or garbled address. */
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

  /** The address with its characters in reverse order — what a no-script reader sees, set right by `<bdo dir="rtl">`. */
  static reversed(address: string): string {
    return Array.from(String(address ?? '')).reverse().join('');
  }

  /** 1..255, from the address: the same address always gets the same key. */
  private static keyFor(value: string): number {
    let sum = 0;
    for (let index = 0; index < value.length; index += 1) sum = (sum * 31 + value.charCodeAt(index)) % 255;
    return sum + 1;
  }
}

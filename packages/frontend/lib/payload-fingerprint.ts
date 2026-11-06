import { createHash } from 'node:crypto';

/**
 * A short fingerprint of a JSON payload, computed once per object: the same object asked about again
 * (a dictionary kept across requests) costs nothing the second time.
 */
export class PayloadFingerprint {
  private static readonly prints = new WeakMap<object, string>();

  static of(payload: object): string {
    let print = PayloadFingerprint.prints.get(payload);
    if (!print) {
      print = createHash('sha1').update(JSON.stringify(payload)).digest('base64url');
      PayloadFingerprint.prints.set(payload, print);
    }
    return print;
  }
}

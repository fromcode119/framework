import { createCipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto';

/**
 * The body of a web push message, encrypted for one browser (RFC 8291, `aes128gcm` of RFC 8188).
 *
 * A push service carries the message but must not be able to read it, so the payload is encrypted to
 * the browser's own key (`p256dh`) and the secret it shared at subscription (`auth`), with a fresh
 * sender key pair and salt for every message. Built on the runtime's own crypto — the protocol is four
 * HKDF steps and one AES-GCM record, and a dependency for that would be one more thing to keep current.
 */
export class WebPushEncryption {
  /** One record holds the whole message: a push service accepts at most 4096 bytes of body. */
  static readonly RECORD_SIZE = 4096;
  /** What a browser can be handed after the header, the padding delimiter and the GCM tag. */
  static readonly MAX_PAYLOAD_BYTES = 3993;
  private static readonly LAST_RECORD = 0x02;

  /**
   * The encrypted body for `subscription`. `sender` and `salt` are fixed only by tests (the RFC's own
   * example); every real message gets fresh ones.
   */
  static encrypt(
    payload: Buffer | string,
    subscription: { p256dh: string; auth: string },
    fixed: { senderPrivateKey?: Buffer; salt?: Buffer } = {},
  ): Buffer {
    const plaintext = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
    if (plaintext.length > WebPushEncryption.MAX_PAYLOAD_BYTES) throw new Error(`A push message is limited to ${WebPushEncryption.MAX_PAYLOAD_BYTES} bytes`);
    const receiverPublic = Buffer.from(subscription.p256dh, 'base64url');
    const authSecret = Buffer.from(subscription.auth, 'base64url');
    if (receiverPublic.length !== 65 || receiverPublic[0] !== 0x04 || authSecret.length !== 16) throw new Error('Not a usable push subscription key');

    const sender = createECDH('prime256v1');
    if (fixed.senderPrivateKey) sender.setPrivateKey(fixed.senderPrivateKey);
    else sender.generateKeys();
    const senderPublic = sender.getPublicKey();
    const sharedSecret = sender.computeSecret(receiverPublic);
    const salt = fixed.salt ?? randomBytes(16);

    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'latin1'), receiverPublic, senderPublic]);
    const ikm = WebPushEncryption.hkdf(authSecret, sharedSecret, keyInfo, 32);
    const contentKey = WebPushEncryption.hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0', 'latin1'), 16);
    const nonce = WebPushEncryption.hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0', 'latin1'), 12);

    const cipher = createCipheriv('aes-128-gcm', contentKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([WebPushEncryption.LAST_RECORD])])), cipher.final(), cipher.getAuthTag()]);

    const header = Buffer.alloc(21);
    salt.copy(header, 0);
    header.writeUInt32BE(WebPushEncryption.RECORD_SIZE, 16);
    header.writeUInt8(senderPublic.length, 20);
    return Buffer.concat([header, senderPublic, ciphertext]);
  }

  private static hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
    return Buffer.from(hkdfSync('sha256', ikm, salt, info, length));
  }
}

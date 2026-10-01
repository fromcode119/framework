import { createDecipheriv, createECDH, hkdfSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebPushEncryption } from '@core/push/web-push-encryption';

/** The encryption must be exactly the protocol's, or every browser silently drops the message. */
describe('web push encryption (RFC 8291)', () => {
  // RFC 8291, Appendix A.
  const rfc = {
    plaintext: 'When I grow up, I want to be a watermelon',
    senderPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    receiverPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
    receiverPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    salt: 'DGv6ra1nlYgDCS1FRnbzlw',
    body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  };

  it('produces the RFC\'s example message byte for byte', () => {
    const body = WebPushEncryption.encrypt(rfc.plaintext, { p256dh: rfc.receiverPublic, auth: rfc.auth }, {
      senderPrivateKey: Buffer.from(rfc.senderPrivate, 'base64url'),
      salt: Buffer.from(rfc.salt, 'base64url'),
    });
    expect(body.toString('base64url')).toBe(rfc.body);
  });

  /** What a browser does with it: derive the same keys from its side and open the record. */
  const decrypt = (body: Buffer, receiverPrivate: Buffer, auth: Buffer): string => {
    const salt = body.subarray(0, 16);
    const idLength = body.readUInt8(20);
    const senderPublic = body.subarray(21, 21 + idLength);
    const record = body.subarray(21 + idLength);
    const receiver = createECDH('prime256v1');
    receiver.setPrivateKey(receiverPrivate);
    const secret = receiver.computeSecret(senderPublic);
    const info = Buffer.concat([Buffer.from('WebPush: info\0', 'latin1'), receiver.getPublicKey(), senderPublic]);
    const ikm = Buffer.from(hkdfSync('sha256', secret, auth, info, 32));
    const key = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'latin1'), 16));
    const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'latin1'), 12));
    const decipher = createDecipheriv('aes-128-gcm', key, nonce);
    decipher.setAuthTag(record.subarray(record.length - 16));
    const padded = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()]);
    return padded.subarray(0, padded.lastIndexOf(0x02)).toString('utf8');
  };

  it('a fresh message opens with the browser\'s own keys, and never repeats its sender key or salt', () => {
    const browser = createECDH('prime256v1');
    browser.generateKeys();
    const auth = Buffer.alloc(16, 7);
    const subscription = { p256dh: browser.getPublicKey().toString('base64url'), auth: auth.toString('base64url') };
    const first = WebPushEncryption.encrypt('{"title":"Здравейте"}', subscription);
    const second = WebPushEncryption.encrypt('{"title":"Здравейте"}', subscription);
    expect(decrypt(first, browser.getPrivateKey(), auth)).toBe('{"title":"Здравейте"}');
    expect(first.subarray(0, 16).equals(second.subarray(0, 16))).toBe(false);
    expect(first.subarray(21, 86).equals(second.subarray(21, 86))).toBe(false);
  });

  it('refuses a message too big for one record, and a key that is not a browser\'s', () => {
    const browser = createECDH('prime256v1');
    browser.generateKeys();
    const subscription = { p256dh: browser.getPublicKey().toString('base64url'), auth: Buffer.alloc(16).toString('base64url') };
    expect(() => WebPushEncryption.encrypt('x'.repeat(4000), subscription)).toThrow(/limited/);
    expect(() => WebPushEncryption.encrypt('hi', { p256dh: 'AAAA', auth: subscription.auth })).toThrow(/usable/);
  });
});

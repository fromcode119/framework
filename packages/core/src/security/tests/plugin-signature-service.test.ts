import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { PluginSignatureService } from '@core/security/plugin-signature-service';

describe('PluginSignatureService', () => {
  it('includes nested manifest fields in signature verification', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const manifest = {
      slug: 'signed-plugin',
      permissions: { database: { read: true, write: false } },
    };
    const canonical = '{"permissions":{"database":{"read":true,"write":false}},"slug":"signed-plugin"}';
    const signer = crypto.createSign('sha256');
    signer.update(canonical);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');

    expect(PluginSignatureService.verify(manifest, signature, publicKey.export({ type: 'spki', format: 'pem' }).toString())).toBe(true);
    expect(PluginSignatureService.verify({ ...manifest, permissions: { database: { read: false, write: false } } }, signature, publicKey.export({ type: 'spki', format: 'pem' }).toString())).toBe(false);
  });
});

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { InternalServiceAuth } from '@core/security/internal-service-auth';

/**
 * The last certificate bundle the api handed the gateway, kept ENCRYPTED in the deployment's data
 * directory so a gateway that restarts can terminate TLS before the api is back.
 *
 * Without it the gateway held its certificates only in memory. That survives an api restart, but not
 * a restart of the gateway itself: an upgrade that restarts every container started the gateway with
 * no certificates, and every handshake was refused ("no certificates configured") until the api had
 * booted and answered — minutes in which every site on the server showed a connection error.
 *
 * The same ownership as `secrets.json`: the API WRITES (it holds the certificates and the data
 * directory is writable for it), the gateway only READS through its read-only mount of that
 * directory. The gateway uses the snapshot only until its first successful fetch, so a certificate
 * removed in the admin stops being served exactly as soon as before — the api rewrites the snapshot
 * on every fetch whose content changed.
 *
 * The file holds private keys, so it is AES-256-GCM encrypted with a key derived from the
 * internal-service secret, written 0600 through a temporary file and a rename. No secret → nothing is
 * written and nothing is read, exactly like the certificates route itself.
 */
export class CertificateBundleSnapshot {
  static readonly FILE_NAME = 'gateway-certificates.enc';
  private static readonly KEY_LABEL = 'fromcode:gateway-certificate-snapshot:v1';
  private static lastWrittenDigest = '';

  /** Store the bundle the api just served. Never throws: failing to keep a copy must not fail the fetch. */
  static write(bundle: unknown, directory: string = ProjectPaths.getDataDir()): boolean {
    const key = CertificateBundleSnapshot.key();
    if (!key) return false;
    try {
      const plain = Buffer.from(JSON.stringify(bundle), 'utf8');
      const digest = crypto.createHash('sha256').update(plain).digest('hex');
      const file = path.join(directory, CertificateBundleSnapshot.FILE_NAME);
      if (digest === CertificateBundleSnapshot.lastWrittenDigest && fs.existsSync(file)) return false;

      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(plain), cipher.final()]);
      const sealed = { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };

      fs.mkdirSync(directory, { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(sealed), { mode: 0o600 });
      fs.renameSync(temporary, file);
      fs.chmodSync(file, 0o600);
      CertificateBundleSnapshot.lastWrittenDigest = digest;
      return true;
    } catch (error: any) {
      console.warn(`[certificates] could not keep the gateway snapshot: ${error?.message || error}`);
      return false;
    }
  }

  /**
   * The stored bundle, or null when there is none, no secret, or it cannot be opened (another secret,
   * a damaged file). Null always means "no snapshot", never a reason to stop.
   */
  static read(directory: string = ProjectPaths.getDataDir()): unknown {
    const key = CertificateBundleSnapshot.key();
    if (!key) return null;
    try {
      const sealed = JSON.parse(fs.readFileSync(path.join(directory, CertificateBundleSnapshot.FILE_NAME), 'utf8'));
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(String(sealed?.iv || ''), 'base64'));
      decipher.setAuthTag(Buffer.from(String(sealed?.tag || ''), 'base64'));
      const plain = Buffer.concat([decipher.update(Buffer.from(String(sealed?.data || ''), 'base64')), decipher.final()]);
      return JSON.parse(plain.toString('utf8'));
    } catch {
      return null;
    }
  }

  private static key(): Buffer | null {
    const secret = InternalServiceAuth.secret();
    if (!secret) return null;
    return crypto.createHash('sha256').update(`${CertificateBundleSnapshot.KEY_LABEL}:${secret}`).digest();
  }
}

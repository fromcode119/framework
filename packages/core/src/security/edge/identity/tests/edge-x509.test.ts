import { describe, expect, it } from 'vitest';
import tls from 'tls';
import { X509Certificate } from 'crypto';
import { EdgeX509 } from '@core/security/edge/identity/edge-x509';

/** A chain built the way the authority builds it: root → working certificate → leaf. */
async function chain() {
  const now = new Date(Date.now() - 60_000);
  const later = new Date(Date.now() + 3_600_000);
  const rootKeys = await EdgeX509.generateKeyPair();
  const root = await EdgeX509.certificate({ serial: EdgeX509.serial(), subject: 'Test Edge Root', issuer: 'Test Edge Root', notBefore: now, notAfter: later, publicKey: rootKeys.publicKey, signingKey: rootKeys.privateKey, authority: true, pathLength: 1 });
  const midKeys = await EdgeX509.generateKeyPair();
  const mid = await EdgeX509.certificate({ serial: EdgeX509.serial(), subject: 'Test Edge Working', issuer: 'Test Edge Root', notBefore: now, notAfter: later, publicKey: midKeys.publicKey, signingKey: rootKeys.privateKey, issuerKeyId: EdgeX509.keyIdOf(root), authority: true, pathLength: 0 });
  const leaf = async (cn: string, options: { clientAuth?: boolean; serverAuth?: boolean; uri?: string; dnsNames?: string[]; ipAddresses?: string[] }) => {
    const keys = await EdgeX509.generateKeyPair();
    const request = await EdgeX509.request(cn, keys);
    const publicKey = await EdgeX509.readRequest(request);
    if (!publicKey) throw new Error('request refused');
    const certificate = await EdgeX509.certificate({ serial: EdgeX509.serial(), subject: cn, issuer: 'Test Edge Working', notBefore: now, notAfter: later, publicKey, signingKey: midKeys.privateKey, issuerKeyId: EdgeX509.keyIdOf(mid), ...options });
    return { certificate, key: await EdgeX509.exportPrivateKey(keys.privateKey) };
  };
  return { root, mid, leaf };
}

describe('EdgeX509', () => {
  it('builds a chain Node accepts, with the identity in the certificate', async () => {
    const { root, mid, leaf } = await chain();
    const edge = await leaf('edge-1', { clientAuth: true, uri: 'spiffe://platform.test/edge/edge-1' });
    const parsed = new X509Certificate(edge.certificate);
    expect(parsed.verify(new X509Certificate(mid).publicKey)).toBe(true);
    expect(new X509Certificate(mid).verify(new X509Certificate(root).publicKey)).toBe(true);
    expect(parsed.subjectAltName).toBe('URI:spiffe://platform.test/edge/edge-1');
    expect(new X509Certificate(root).ca).toBe(true);
    expect(parsed.ca).toBe(false);
  });

  it('completes a mutual TLS handshake, and refuses a client the root never vouched for', async () => {
    const { root, mid, leaf } = await chain();
    const server = await leaf('control', { serverAuth: true, ipAddresses: ['127.0.0.1', '::1'], dnsNames: ['control.test'] });
    const client = await leaf('edge-1', { clientAuth: true, uri: 'spiffe://platform.test/edge/edge-1' });
    const stranger = await (await chain()).leaf('edge-1', { clientAuth: true });

    const seen: string[] = [];
    const listener = tls.createServer({ cert: server.certificate + mid, key: server.key, ca: root, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.3' }, (socket) => {
      seen.push(String(socket.getPeerCertificate().subjectaltname));
      socket.end('ok');
    });
    await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const port = (listener.address() as { port: number }).port;
    const connect = (who: { certificate: string; key: string }, extraChain: string) => new Promise<string>((resolve) => {
      const socket = tls.connect({ host: '127.0.0.1', port, cert: who.certificate + extraChain, key: who.key, ca: root, servername: 'control.test' }, () => undefined);
      let data = '';
      socket.on('data', (chunk) => { data += chunk; });
      socket.on('end', () => resolve(data));
      socket.on('error', (error) => resolve(`error:${(error as NodeJS.ErrnoException).code ?? error.message}`));
    });
    try {
      expect(await connect(client, mid)).toBe('ok');
      expect(seen).toEqual(['URI:spiffe://platform.test/edge/edge-1']);
      expect(await connect(stranger, '')).toMatch(/^error:|^$/);
      expect(seen).toHaveLength(1);
    } finally {
      listener.close();
    }
  });

  it('refuses a request whose signature does not match its key', async () => {
    const keys = await EdgeX509.generateKeyPair();
    const request = await EdgeX509.request('edge-1', keys);
    const body = request.split('\n').slice(1, -2).join('');
    const tampered = Buffer.from(body, 'base64');
    tampered[tampered.length - 5] ^= 0xff;
    expect(await EdgeX509.readRequest(EdgeX509.pem('CERTIFICATE REQUEST', tampered))).toBeNull();
  });
});

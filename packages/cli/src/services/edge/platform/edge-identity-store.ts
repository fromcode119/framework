import fs from 'fs';
import path from 'path';
import { EdgeControlPaths, EdgeX509 } from '@fromcode119/core';
import { EdgeControlClient } from '@cli/services/edge/platform/edge-control-client';

/**
 * This edge's identity on a Fromcode platform, kept in its state directory:
 *
 * - `edge.json` — the control address, the root's hash it was joined with, the certificate's end;
 * - `key.pem` (mode 0600) — made here, never sent anywhere;
 * - `certificate.pem` — its certificate and the working certificate that signed it;
 * - `trust.pem` — the platform's root.
 *
 * Joining is kubeadm's discovery: the operator's command carries the root's SHA-256, so the first
 * connection is checked before the one-time token is sent — someone answering on the control address
 * cannot collect the token. From then on the edge renews over its own certificate at half its life.
 */
export class EdgeIdentityStore {
  private static readonly RETRY_MS = 30_000;
  private timer: NodeJS.Timeout | null = null;
  private loaded: { control: string; key: string; cert: string; trust: string; notAfter: number; issuedAt: number } | null = null;

  constructor(private readonly directory: string, private readonly version: string, private readonly now: () => number = Date.now) {}

  /** The SHA-256 of a certificate's DER, as `sha256:<hex>` — what the console's join command carries. */
  static fingerprint(certificatePem: string): string {
    return EdgeX509.fingerprint(certificatePem);
  }

  /** Joins a platform. Throws with the reason, for the operator running the command. */
  async join(control: string, token: string, rootHash: string): Promise<{ edgeId: string; notAfter: string }> {
    const address = EdgeControlClient.parse(control);
    if (!address) throw new Error(`"${control}" is not host:port.`);
    const client = new EdgeControlClient(address.host, address.port, this.version);
    const trusted = await client.request('GET', EdgeControlPaths.TRUST, undefined, { insecure: true });
    if (trusted.status !== 200) throw new Error(`${control} did not answer as a Fromcode control channel (HTTP ${trusted.status || 'none'}).`);
    // Exactly one certificate, and from here on only the copy that was checked: a bundle with the real
    // root first and another certificate after it must not get the second one trusted.
    const trust = EdgeX509.single(String(trusted.body?.trustPem ?? ''));
    const wanted = String(rootHash ?? '').trim().toLowerCase();
    if (!trust || !wanted || EdgeX509.fingerprint(trust) !== wanted) {
      throw new Error(`The platform at ${control} presented a root that does not match ${rootHash}. Nothing was sent. Check the address, or copy the command again from the console.`);
    }
    const keys = await EdgeX509.generateKeyPair();
    const answer = await client.request('POST', EdgeControlPaths.ENROLL, { token, request: await EdgeX509.request('edge', keys) }, { ca: trust });
    if (answer.status !== 200) throw new Error(answer.status === 429 ? 'Too many attempts from this address; wait ten minutes.' : 'The token was refused: it is wrong, already used, or expired. Make a new one in the console.');
    this.write(control, await EdgeX509.exportPrivateKey(keys.privateKey), answer.body, trust);
    return { edgeId: String(answer.body.edgeId), notAfter: String(answer.body.notAfter) };
  }

  /** Reads the identity from disk; false when this edge has not joined. */
  load(): boolean {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(this.directory, 'edge.json'), 'utf8'));
      this.loaded = {
        control: String(meta.control),
        key: fs.readFileSync(path.join(this.directory, 'key.pem'), 'utf8'),
        cert: fs.readFileSync(path.join(this.directory, 'certificate.pem'), 'utf8'),
        trust: fs.readFileSync(path.join(this.directory, 'trust.pem'), 'utf8'),
        notAfter: Date.parse(String(meta.notAfter)),
        issuedAt: Date.parse(String(meta.issuedAt)),
      };
      return true;
    } catch {
      this.loaded = null;
      return false;
    }
  }

  get control(): { host: string; port: number } | null {
    return this.loaded ? EdgeControlClient.parse(this.loaded.control) : null;
  }

  /** Key, certificate and root for a connection to the platform; null when not joined. */
  get tls(): { key: string; cert: string; ca: string } | null {
    return this.loaded ? { key: this.loaded.key, cert: this.loaded.cert, ca: this.loaded.trust } : null;
  }

  /** Whether the certificate is still valid now — part of `/ready`. */
  get valid(): boolean {
    return !!this.loaded && this.loaded.notAfter > this.now();
  }

  get notAfter(): number {
    return this.loaded?.notAfter ?? 0;
  }

  /** Renews at half the certificate's life, and keeps retrying on failure. */
  start(): void {
    const loaded = this.loaded;
    if (!loaded) return;
    const half = loaded.issuedAt + (loaded.notAfter - loaded.issuedAt) / 2;
    this.schedule(Math.max(1_000, half - this.now()));
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async renew(): Promise<boolean> {
    const loaded = this.loaded;
    const control = this.control;
    if (!loaded || !control) return false;
    const keys = await EdgeX509.generateKeyPair();
    const client = new EdgeControlClient(control.host, control.port, this.version);
    const answer = await client.request('POST', EdgeControlPaths.RENEW, { request: await EdgeX509.request('edge', keys) }, { ca: loaded.trust, key: loaded.key, cert: loaded.cert });
    if (answer.status !== 200) {
      console.warn(`[edge] certificate renewal refused (HTTP ${answer.status || 'none'}); valid until ${new Date(loaded.notAfter).toISOString()}`);
      return false;
    }
    // The root stays the one pinned at join: a renewal never changes what this edge trusts.
    this.write(loaded.control, await EdgeX509.exportPrivateKey(keys.privateKey), answer.body, loaded.trust);
    console.log(`[edge] certificate renewed, valid until ${answer.body.notAfter}`);
    return true;
  }

  private schedule(delayMs: number): void {
    this.stop();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.renew().then((renewed) => (renewed ? this.start() : this.schedule(EdgeIdentityStore.RETRY_MS)));
    }, delayMs);
    this.timer.unref?.();
  }

  /** Writes the new identity beside the old, then swaps each file in one rename. */
  private write(control: string, key: string, issued: Record<string, any>, trust: string): void {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const files: Array<[string, string, number]> = [
      ['key.pem', key, 0o600],
      ['certificate.pem', `${issued.certificatePem}${issued.chainPem}`, 0o644],
      ['trust.pem', trust, 0o644],
      // Last: the file `load` starts from, so a crash part-way leaves the previous identity in use.
      ['edge.json', `${JSON.stringify({ control, edgeId: issued.edgeId, issuedAt: new Date(this.now()).toISOString(), notAfter: issued.notAfter }, null, 2)}\n`, 0o644],
    ];
    for (const [name, content, mode] of files) fs.writeFileSync(path.join(this.directory, `${name}.new`), content, { mode });
    for (const [name] of files) fs.renameSync(path.join(this.directory, `${name}.new`), path.join(this.directory, name));
    this.load();
  }
}

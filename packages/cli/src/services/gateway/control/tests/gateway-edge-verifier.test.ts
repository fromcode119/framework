import { describe, expect, it } from 'vitest';
import type tls from 'tls';
import { GatewayEdgeVerifier } from '@cli/services/gateway/control/gateway-edge-verifier';
import type { GatewayControlApi } from '@cli/services/gateway/control/gateway-control-api';

/** The live revocation check: kept briefly when yes, never when no, and the identity must match. */
describe('GatewayEdgeVerifier', () => {
  const socket = (authorized = true, uri = 'URI:spiffe://platform.test/edge/e1') => ({ authorized, remoteAddress: '198.51.100.1', getPeerCertificate: () => ({ serialNumber: 'ABC1', subjectaltname: uri }) }) as unknown as tls.TLSSocket;

  it('cuts a removed edge off once the short cache runs out', async () => {
    let now = 0;
    let allowed = true;
    let asked = 0;
    const api = { post: async () => { asked += 1; return allowed ? { status: 200, body: { edge: { id: 'e1', name: 'Relay' } } } : { status: 403, body: {} }; } } as unknown as GatewayControlApi;
    const verifier = new GatewayEdgeVerifier(api, () => now);
    expect(await verifier.edgeOf(socket())).toEqual({ id: 'e1', name: 'Relay' });
    allowed = false;
    now += GatewayEdgeVerifier.CACHE_MS - 1;
    expect(await verifier.edgeOf(socket())).not.toBeNull();
    now += 2;
    expect(await verifier.edgeOf(socket())).toBeNull();
    expect(asked).toBe(2);
    allowed = true;
    expect(await verifier.edgeOf(socket())).not.toBeNull();
    expect(asked).toBe(3);
  });

  it('refuses an unverified chain without asking, and a certificate naming another edge', async () => {
    let asked = 0;
    const api = { post: async () => { asked += 1; return { status: 200, body: { edge: { id: 'e1', name: '' } } }; } } as unknown as GatewayControlApi;
    const verifier = new GatewayEdgeVerifier(api);
    expect(await verifier.edgeOf(socket(false))).toBeNull();
    expect(asked).toBe(0);
    expect(await verifier.edgeOf(socket(true, 'URI:spiffe://platform.test/edge/e2'))).toBeNull();
  });
});

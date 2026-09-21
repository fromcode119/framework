import { describe, expect, it } from 'vitest';
import { PluginHostGuestBridge } from '@core/plugin/host/plugin-host-guest-bridge';

/**
 * A guest learns its peers from the envelope of an invocation. An HTTP route it serves does not
 * travel that way — the request goes straight to its socket — so before this, a guest that served
 * routes answered them against whatever snapshot its last LIFECYCLE call left: the one taken at
 * BOOT, before its siblings had finished loading.
 *
 * Measured on production (framework 0.2.141): logistics' snapshot was computed once, at 17:34:06,
 * listing 18 peers WITHOUT `org.fromcode:logistics-econt`, which was still `loading` at that
 * instant. Finance — invoked through hooks, so through `invoke` — held a snapshot from 17:34:27
 * that did include it. Econt city search therefore answered `{"cities":[]}` to every query for the
 * life of the process, and the storefront told shoppers Sofia did not exist.
 */
describe('PluginHost peer sync on forwarded requests', () => {
  const host = (sent: Array<{ type: string; payload: any }>, peers: Record<string, string[]>, enabled: string[]) => {
    const instance = Object.create(PluginHostGuestBridge.prototype) as any;
    instance.sentPeerSignature = '';
    instance.limits = { timeoutMs: 1_000, memoryMb: 128 };
    instance.channel = {
      isClosed: false,
      request: async (type: string, payload: any) => { sent.push({ type, payload }); return true; },
    };
    instance.peers = () => peers;
    instance.enabledPlugins = () => enabled;
    return instance;
  };

  it('sends the current snapshot before the first forwarded request', async () => {
    const sent: Array<{ type: string; payload: any }> = [];
    const instance = host(sent, { 'org.fromcode:logistics-econt': ['searchCities'] }, ['logistics-econt']);

    await instance.syncPeers(undefined);

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('peers');
    expect(Object.keys(sent[0].payload.peers)).toContain('org.fromcode:logistics-econt');
  });

  it('sends nothing more while the snapshot is unchanged', async () => {
    const sent: Array<{ type: string; payload: any }> = [];
    const instance = host(sent, { 'org.fromcode:finance': ['quote'] }, ['finance']);

    await instance.syncPeers(undefined);
    await instance.syncPeers(undefined);
    await instance.syncPeers(undefined);

    expect(sent).toHaveLength(1);
  });

  it('sends again when a sibling finishes loading', async () => {
    const sent: Array<{ type: string; payload: any }> = [];
    let peers: Record<string, string[]> = { 'org.fromcode:finance': ['quote'] };
    const instance = host(sent, peers, ['finance']);
    instance.peers = () => peers;

    await instance.syncPeers(undefined);
    peers = { 'org.fromcode:finance': ['quote'], 'org.fromcode:logistics-econt': ['searchCities'] };
    await instance.syncPeers(undefined);

    expect(sent).toHaveLength(2);
    expect(Object.keys(sent[1].payload.peers)).toContain('org.fromcode:logistics-econt');
  });

  it('sends again when a peer that was still loading gains its methods', async () => {
    // The key set never changes here — only the function names do. A signature over keys alone
    // matched, the refresh was skipped, and the guest kept a peer it could see but not call.
    const sent: Array<{ type: string; payload: any }> = [];
    let peers: Record<string, string[]> = { 'org.fromcode:logistics-econt': [] };
    const instance = host(sent, peers, ['logistics-econt']);
    instance.peers = () => peers;

    await instance.syncPeers(undefined);
    expect(sent).toHaveLength(1);
    expect(sent[0].payload.peers['org.fromcode:logistics-econt']).toEqual([]);

    peers = { 'org.fromcode:logistics-econt': ['searchCities', 'searchOffices'] };
    await instance.syncPeers(undefined);

    expect(sent).toHaveLength(2);
    expect(sent[1].payload.peers['org.fromcode:logistics-econt']).toContain('searchCities');
  });

  it('says nothing to a channel that is gone', async () => {
    const sent: Array<{ type: string; payload: any }> = [];
    const instance = host(sent, {}, []);
    instance.channel = null;

    await instance.syncPeers(undefined);

    expect(sent).toHaveLength(0);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import http from 'http';
import net from 'net';
import { GatewayUpstreamProbe } from '@cli/services/gateway/gateway-upstream-probe';

describe('GatewayUpstreamProbe', () => {
  const closes: Array<() => void> = [];
  afterEach(() => { closes.splice(0).forEach((close) => close()); });

  const listen = async (server: net.Server): Promise<string> => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    closes.push(() => { (server as http.Server).closeAllConnections?.(); server.close(); });
    return `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
  };

  /** An agent whose one socket is taken by a request that never finishes, so the next one waits for a socket. */
  const fullPool = (target: string): http.Agent => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    http.get(new URL('/', target), { agent }, (res) => res.resume()).on('error', () => undefined);
    closes.push(() => agent.destroy());
    return agent;
  };

  /** An agent that has free capacity but whose address lookup never comes back, so requests wait with no socket. */
  const stuckLookup = (): http.Agent => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: 4, lookup: () => undefined } as http.AgentOptions);
    closes.push(() => agent.destroy());
    return agent;
  };

  it('is silent when the frontend answers through the pool', async () => {
    const target = await listen(http.createServer((_req, res) => res.end('ok')));
    expect(await new GatewayUpstreamProbe(target, new http.Agent({ keepAlive: true }), 300).stalled()).toBeNull();
  });

  it('blames the gateway when the pooled request waits with free capacity but a new connection is answered', async () => {
    const target = await listen(http.createServer((_req, res) => res.end('ok')));
    // By name: an address given as a number never goes through the agent's lookup.
    const problem = await new GatewayUpstreamProbe(target.replace('127.0.0.1', 'localhost'), stuckLookup(), 300).stalled();
    expect(problem).toMatch(/pooled requests to the frontend get no answer in 300 ms/);
  });

  it('blames the gateway for a pool full of connections that move nothing (sockets held for nobody)', async () => {
    let held = 0;
    const target = await listen(http.createServer((_req, res) => { if (held++ > 0) res.end('ok'); }));
    const agent = fullPool(target);
    await new Promise((resolve) => setTimeout(resolve, 100)); // the held request has been sent and is now silent
    expect(await new GatewayUpstreamProbe(target, agent, 300).stalled()).toMatch(/pooled requests to the frontend/);
  });

  it('does not blame the gateway for a pool full of connections that are still moving bytes', async () => {
    let held = 0;
    const target = await listen(http.createServer((_req, res) => {
      if (held++ > 0) { res.end('ok'); return; }
      res.writeHead(200);
      const trickle = setInterval(() => res.write('.'), 50);
      res.on('close', () => clearInterval(trickle));
      closes.push(() => clearInterval(trickle));
    }));
    expect(await new GatewayUpstreamProbe(target, fullPool(target), 300).stalled()).toBeNull();
  });

  it('does not blame the gateway when the frontend answers nothing at all', async () => {
    const target = await listen(http.createServer(() => undefined));
    expect(await new GatewayUpstreamProbe(target, new http.Agent({ keepAlive: true }), 200).stalled()).toBeNull();
  });

  it('does not blame the gateway for a frontend that refuses connections, or when there is none', async () => {
    const probe = new GatewayUpstreamProbe('http://127.0.0.1:1', new http.Agent(), 300);
    expect(await probe.stalled()).toBeNull();
    expect(await new GatewayUpstreamProbe('', new http.Agent(), 300).stalled()).toBeNull();
  });
});

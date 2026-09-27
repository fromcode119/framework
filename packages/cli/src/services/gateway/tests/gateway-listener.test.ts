import { afterEach, describe, expect, it } from 'vitest';
import http from 'http';
import net from 'net';
import { GatewayListener } from '@cli/services/gateway/gateway-listener';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';

/** Sends raw bytes and reads the whole reply. */
class RawClient {
  static exchange(port: number, bytes: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ port, host: '127.0.0.1' }, () => socket.write(bytes));
      let text = '';
      socket.on('data', (chunk) => { text += chunk.toString(); });
      socket.on('end', () => resolve(text));
      socket.on('close', () => resolve(text));
      socket.on('error', reject);
    });
  }

  static request(path = '/'): Buffer {
    return Buffer.from(`GET ${path} HTTP/1.1\r\nHost: probe.test\r\nConnection: close\r\n\r\n`);
  }
}

/**
 * The gateway's port behind `edge`: the visitor comes from the PROXY header, a direct caller still works,
 * and stopping lets the request in flight finish while refusing new connections — what lets a deploy
 * replace the gateway with no failed request.
 */
describe('GatewayListener', () => {
  const listeners: GatewayListener[] = [];
  afterEach(async () => { await Promise.all(listeners.splice(0).map((listener) => listener.stop(0))); });

  const start = async (handler: http.RequestListener): Promise<GatewayListener> => {
    const listener = new GatewayListener(http.createServer(handler));
    listeners.push(listener);
    listener.listen(0, () => undefined);
    await listener.listening;
    return listener;
  };

  it('tells the server the visitor named in the PROXY header', async () => {
    const listener = await start((req, res) => res.end(`from ${req.socket.remoteAddress}:${req.socket.remotePort}`));
    const reply = await RawClient.exchange(listener.port, Buffer.concat([GatewayProxyProtocol.header('203.0.113.7', 40123), RawClient.request()]));
    expect(reply).toMatch(/^HTTP\/1\.1 200/);
    expect(reply).toContain('from 203.0.113.7:40123');
  });

  it('serves a direct caller on the container network, which sends no header', async () => {
    const listener = await start((req, res) => res.end('direct'));
    const reply = await RawClient.exchange(listener.port, RawClient.request());
    expect(reply).toContain('direct');
  });

  it('closes a connection whose header cannot be read', async () => {
    const listener = await start((_req, res) => res.end('should not answer'));
    const broken = Buffer.concat([GatewayProxyProtocol.SIGNATURE, Buffer.from([0x11, 0x11, 0x00, 0x00])]);
    expect(await RawClient.exchange(listener.port, broken)).toBe('');
  });

  it('on stop: finishes the request in flight, refuses new connections, then resolves', async () => {
    let release: () => void = () => undefined;
    const listener = await start((_req, res) => { release = () => res.end('finished'); });
    const inFlight = RawClient.exchange(listener.port, RawClient.request());
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stopped = listener.stop(5_000);
    await expect(RawClient.exchange(listener.port, RawClient.request())).rejects.toThrow();
    release();
    expect(await inFlight).toContain('finished');
    await stopped;
    expect(listener.openConnections).toBe(0);
  });
});

describe('GatewayProxyProtocol.decide', () => {
  it('reads an IPv4 PROXY header, and says when there is none or too little to tell', () => {
    const header = GatewayProxyProtocol.header('198.51.100.9', 443);
    expect(GatewayProxyProtocol.decide(header)).toEqual({ address: '198.51.100.9', port: 443, length: header.length });
    expect(GatewayProxyProtocol.decide(header.subarray(0, 10))).toBeNull();
    expect(GatewayProxyProtocol.decide(Buffer.from('GET / HTTP/1.1'))).toBe(false);
  });
});

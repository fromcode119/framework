import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import net from 'node:net';
import { EdgeConfig } from '@cli/services/edge/config/edge-config';
import { EdgeHello } from '@cli/services/edge/edge-hello';
import { EdgeFileRules } from '@cli/services/edge/rules/edge-file-rules';

describe('EdgeConfig', () => {
  it('refuses a configuration that does not say exactly what to do, listing every problem', () => {
    let message = '';
    try {
      EdgeConfig.parse({ listeners: [{ port: 80, protocol: 'http' }, { port: 80, protocol: 'udp' }], origins: [{ name: 'a', hosts: ['*'], transport: 'tcp', address: 'x', ports: {} }, { name: 'a', hosts: ['*'], transport: 'fromcode' }], rules: { source: 'cloud' } });
    } catch (error: any) { message = error.message; }
    for (const problem of ['protocol: http or tls', 'a port is listed twice', 'ports.http', 'proxyProtocol: true or false', 'only one may serve "*"', 'two have the same name', 'rules.source', 'fromcode.state']) expect(message).toContain(problem);
  });

  it('reads a valid one, and routes a host by exact name, then *.name, then *', () => {
    const config = EdgeConfig.parse({
      listeners: [{ port: 443, protocol: 'tls', acceptProxyFrom: ['203.0.113.0/24'] }],
      origins: [
        { name: 'wild', hosts: ['*.example.test'], transport: 'tcp', address: '10.0.0.2', ports: { tls: 8443 }, proxyProtocol: false },
        { name: 'any', hosts: ['*'], transport: 'tcp', address: '10.0.0.3', ports: { tls: 443 }, proxyProtocol: true, health: { type: 'none' } },
      ],
    });
    expect(config.rules.source).toBe('none');
    const [wild] = config.origins;
    expect(wild.serves('shop.example.test')).toBe(true);
    expect(wild.serves('example.test')).toBe(false);
    expect(config.listeners[0].acceptProxyFrom).toEqual(['203.0.113.0/24']);
  });
});

describe('EdgeHello', () => {
  it('reads the server name from a real ClientHello and the Host of a request', async () => {
    const hello = await new Promise<Buffer>((resolve) => {
      const server = net.createServer((socket) => socket.once('data', (chunk) => { resolve(chunk); socket.destroy(); server.close(); }));
      server.listen(0, () => { const client = tls.connect({ port: (server.address() as net.AddressInfo).port, host: '127.0.0.1', servername: 'Shop.Example.Test' }); client.on('error', () => undefined); });
    });
    expect(EdgeHello.tlsHost(hello)).toBe('shop.example.test');
    expect(EdgeHello.tlsHost(hello.subarray(0, 20))).toBeUndefined();
    expect(EdgeHello.httpHost(Buffer.from('GET / HTTP/1.1\r\nHost: Blog.Test:8080\r\n\r\n'))).toBe('blog.test');
    expect(EdgeHello.httpHost(Buffer.from('GET / HTTP/1.1\r\nHost: blog'))).toBeUndefined();
  });
});

describe('EdgeFileRules', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-rules-'));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('applies the file, and keeps the rules in force when an edit breaks it', () => {
    const file = path.join(dir, 'rules.yaml');
    fs.writeFileSync(file, 'blocked: [192.0.2.0/24]\nstops: [{ address: 203.0.113.9, until: 2099-01-01T00:00:00Z }]\n');
    const rules = new EdgeFileRules(file);
    expect(rules.read()).toEqual([]);
    expect(rules.current.refuses('192.0.2.5', Date.now())).toBe(true);
    expect(rules.current.refuses('203.0.113.9', Date.now())).toBe(true);
    fs.writeFileSync(file, 'blocked: [not-an-address]\n');
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5_000));
    expect(rules.read()).toEqual(['blocked: "not-an-address" is not an address or block']);
    expect(rules.current.refuses('192.0.2.5', Date.now())).toBe(true);
    expect(rules.fresh).toBe(false);
  });
});

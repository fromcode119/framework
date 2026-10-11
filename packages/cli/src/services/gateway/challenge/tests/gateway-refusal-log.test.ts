import { describe, expect, it } from 'vitest';
import http from 'http';
import { GatewayRefusalLog } from '@cli/services/gateway/challenge/gateway-refusal-log';

class RefusalFixture {
  static request(address: string, url: string): http.IncomingMessage {
    return { socket: { remoteAddress: address }, headers: { host: 'Shop.Test:443' }, method: 'GET', url } as unknown as http.IncomingMessage;
  }
}

describe('GatewayRefusalLog', () => {
  it('writes one parseable line per refused visitor and reason, without the query', () => {
    const lines: string[] = [];
    let now = 1_000_000;
    const log = new GatewayRefusalLog((line) => lines.push(line), () => now);
    log.record(RefusalFixture.request('203.0.113.7', '/search?q=private@example.test'), 'sql_injection');
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('[edge-refused] ')).toBe(true);
    const entry = JSON.parse(lines[0].slice('[edge-refused] '.length));
    expect(entry).toMatchObject({ reason: 'sql_injection', address: '203.0.113.7', host: 'shop.test', method: 'GET', path: '/search' });
    expect(lines[0]).not.toContain('private@example.test');

    // The same visitor and reason again within a minute: nothing more. Another reason or visitor: a line.
    log.record(RefusalFixture.request('203.0.113.7', '/x'), 'sql_injection');
    log.record(RefusalFixture.request('203.0.113.7', '/x'), 'rate_limited');
    log.record(RefusalFixture.request('203.0.113.8', '/x'), 'sql_injection');
    expect(lines).toHaveLength(3);
    now += 60_000;
    log.record(RefusalFixture.request('203.0.113.7', '/x'), 'sql_injection');
    expect(lines).toHaveLength(4);
  });
});

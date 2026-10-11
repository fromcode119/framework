import http from 'http';
import { EdgeProtection } from '@fromcode119/core';

/**
 * Refuses a request whose ADDRESS carries a known attack, while Settings → Security → Edge protection →
 * "Block attack patterns" is on: the categories below (named in that setting's description), the
 * operator's blocked paths and the attack tools named in blocked user agents.
 *
 * Only the path and query are read — never a body — after decoding twice, because attackers encode
 * twice to slip past a filter that decodes once. The patterns are deliberately narrow (`union …
 * select`, not `select`) so a shopper's search for "select size" is never refused.
 */
export class GatewayAttackFilter {
  private static readonly PATTERNS: ReadonlyArray<{ category: string; pattern: RegExp }> = [
    { category: 'path_traversal', pattern: /\.\.[/\\]/ },
    { category: 'sql_injection', pattern: /\bunion\b[\s\S]{0,40}\bselect\b/i },
    { category: 'sql_injection', pattern: /\binformation_schema\b/i },
    { category: 'sql_injection', pattern: /'\s*(?:or|and)\s+'?\d+'?\s*=\s*'?\d+/i },
    { category: 'sql_injection', pattern: /\b(?:sleep|benchmark|pg_sleep)\s*\(\s*\d/i },
    { category: 'sql_injection', pattern: /;\s*(?:drop|truncate)\s+table\b/i },
    { category: 'script_injection', pattern: /<\s*script\b/i },
    { category: 'script_injection', pattern: /\bjavascript\s*:/i },
    { category: 'script_injection', pattern: /\bon(?:error|load)\s*=/i },
    { category: 'log4shell', pattern: /\$\{\s*(?:jndi|lower|upper|env)\s*:/i },
  ];

  /** The category a request is refused for, or null when it may pass. */
  static reasonFor(req: http.IncomingMessage, protection: EdgeProtection): string | null {
    if (!protection.blockAttackPatterns) return null;
    const agent = String(req.headers['user-agent'] || '').toLowerCase();
    if (agent && protection.blockedAgents.some((tool) => agent.includes(tool.toLowerCase()))) return 'blocked_tool';
    const address = GatewayAttackFilter.decoded(req.url || '/');
    const path = address.split('?')[0].toLowerCase();
    if (protection.blockedPaths.some((prefix) => path.startsWith(prefix.toLowerCase()))) return 'blocked_path';
    return GatewayAttackFilter.PATTERNS.find(({ pattern }) => pattern.test(address))?.category ?? null;
  }

  /** The address decoded twice; a malformed escape is kept as written rather than letting it hide. */
  private static decoded(url: string): string {
    let value = url.replace(/\+/g, ' ');
    for (let pass = 0; pass < 2; pass += 1) {
      try { value = decodeURIComponent(value); } catch { break; }
    }
    return value;
  }
}

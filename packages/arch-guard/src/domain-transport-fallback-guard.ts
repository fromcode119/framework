/* eslint-disable */
import { SourceTree } from './source-tree';
import { FrameworkRoot } from './cli/framework-root';
import path from 'node:path';

/**
 * A domain method falling back to a raw HTTP call when it is not there.
 *
 * `peer?.createOrder ? peer.createOrder(payload) : client.post('/orders', payload)` looks defensive and
 * is the opposite. The fallback hardcodes a route the owning extension is free to change, so the day
 * the method exists the call is fine and the day it does not, a stale URL is used instead of the
 * failure that would have said so. Cross-extension coupling goes through the namespace API or a
 * registry; there is no third option that is merely less reliable.
 *
 * Extension code only — the framework has no domain methods to fall back from. Reports rather than
 * gates, like the other extension-facing checks here: the backlog is somebody else's and a guard that
 * fails on it gets switched off.
 */
export class DomainTransportFallbackGuard {
  /**
   * A ternary whose alternative is a bare `.post(` / `.get(` — the transport standing in for a method.
   *
   * Matched over the WHOLE file, not line by line, because `\s*` spans newlines and the real ones do:
   * the `?` ends one line and the call sits on the next. A per-line scan of the same pattern found
   * nothing where a whole-file scan found a genuine case.
   */
  private static readonly FALLBACK = /\?\s*[^:\n]+?\.[gp]ost\(/g;

  static run(): number {
    const repo = FrameworkRoot.repo();
    const findings: string[] = [];

    for (const area of ['plugins', 'themes']) {
      for (const file of SourceTree.files(path.join(repo, area), (name) => /\.tsx?$/.test(name))) {
        const source = SourceTree.lines(file).join('\n');
        for (const match of source.matchAll(DomainTransportFallbackGuard.FALLBACK)) {
          const line = source.slice(0, match.index!).split('\n').length;
          findings.push(`  ${SourceTree.cite(file)}:${line}  ${match[0].replace(/\s+/g, ' ').trim().slice(0, 100)}`);
        }
      }
    }

    console.log(`Domain methods falling back to raw transport: ${findings.length}`);
    for (const finding of findings) console.log(finding);
    if (findings.length) {
      console.log('  Reach the peer through the namespace API. A hardcoded route outlives the method it stands in for.');
    }
    return 0;
  }
}

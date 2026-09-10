import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { gzipSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import { ParityHarness } from '@extension-builder/tests/parity/parity-harness';

function tree(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'parity-'));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

describe('ParityHarness', () => {
  it('reports a file present in only one tree', () => {
    const d = ParityHarness.compare(
      ParityHarness.hashTree(tree({ 'a.js': 'x', 'b.js': 'y' })),
      ParityHarness.hashTree(tree({ 'a.js': 'x' })),
    );
    expect(d.onlyLeft).toEqual(['b.js']);
  });

  it('compares a .gz by its PAYLOAD, so a differing gzip header is not a difference', () => {
    const payload = 'const a=1;'.repeat(20);
    const left = tree({ 'ui/bundle.js.gz': gzipSync(Buffer.from(payload), { level: 9 }) });
    const right = tree({ 'ui/bundle.js.gz': gzipSync(Buffer.from(payload), { level: 6 }) });
    expect(ParityHarness.compare(ParityHarness.hashTree(left), ParityHarness.hashTree(right)).differing).toEqual([]);
  });

  it('still catches a .gz whose payload genuinely differs — this is how the missing shim was found', () => {
    const left = tree({ 'ui/bundle.js.gz': gzipSync(Buffer.from('with shim')) });
    const right = tree({ 'ui/bundle.js.gz': gzipSync(Buffer.from('without')) });
    expect(ParityHarness.compare(ParityHarness.hashTree(left), ParityHarness.hashTree(right)).differing)
      .toEqual(['ui/bundle.js.gz']);
  });

  it('excuses nothing: any difference is a difference', () => {
    // There is deliberately no accepted-differences list. Two builds of the same extension produce
    // byte-identical trees, so anything reported here is a regression.
    const left = tree({ 'ui/style.css': '/*! a */\n.x{}', 'ui/tracker.js': 'a', 'manifest.json': '{"checksum":"1"}' });
    const right = tree({ 'ui/style.css': '/*! b */\n.x{}', 'ui/tracker.js': 'b', 'manifest.json': '{"checksum":"2"}' });
    expect(ParityHarness.compare(ParityHarness.hashTree(left), ParityHarness.hashTree(right)).differing)
      .toEqual(['manifest.json', 'ui/style.css', 'ui/tracker.js']);
  });

  it('names no extension — a framework package must not know a plugin slug', () => {
    const source = readFileSync(join(__dirname, 'parity-harness.ts'), 'utf8');
    for (const slug of ['analytics', 'numerology', 'ecommerce', 'tagiqx', 'forms']) {
      expect(source.includes(slug), `parity-harness.ts must not name "${slug}"`).toBe(false);
    }
  });
});

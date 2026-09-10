import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
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
    // The gzip CLI writes a filename and mtime into the header; zlib does not. Same bytes in.
    const payload = 'const a=1;'.repeat(20);
    const left = tree({ 'ui/bundle.js.gz': gzipSync(Buffer.from(payload), { level: 9 }) });
    const right = tree({ 'ui/bundle.js.gz': gzipSync(Buffer.from(payload), { level: 6 }) });
    const d = ParityHarness.compare(ParityHarness.hashTree(left), ParityHarness.hashTree(right));
    expect(d.differing).toEqual([]);
  });

  it('still catches a .gz whose payload genuinely differs — this is how the missing shim was found', () => {
    const left = tree({ 'ui/bundle.js.gz': gzipSync(Buffer.from('with shim')) });
    const right = tree({ 'ui/bundle.js.gz': gzipSync(Buffer.from('without')) });
    const d = ParityHarness.compare(ParityHarness.hashTree(left), ParityHarness.hashTree(right));
    expect(d.differing).toEqual(['ui/bundle.js.gz']);
  });

  it('applies a slug-scoped exception ONLY to that extension', () => {
    const left = ParityHarness.hashTree(tree({ 'ui/tracker.js': 'a' }));
    const right = ParityHarness.hashTree(tree({ 'ui/tracker.js': 'b' }));
    expect(ParityHarness.compare(left, right, 'analytics').differing).toEqual([]);
    expect(ParityHarness.compare(left, right, 'numerology').differing).toEqual(['ui/tracker.js']);
  });

  it('accepts the .gz of an accepted file by derivation, not as its own entry', () => {
    const named = ParityHarness.ACCEPTED_DIFFERENCES.map((d) => d.file);
    expect(named).toContain('ui/style.css');
    expect(named).not.toContain('ui/style.css.gz');

    const left = ParityHarness.hashTree(tree({ 'ui/style.css.gz': gzipSync(Buffer.from('/*! a */.x{}')) }));
    const right = ParityHarness.hashTree(tree({ 'ui/style.css.gz': gzipSync(Buffer.from('/*! b */.x{}')) }));
    expect(ParityHarness.compare(left, right).differing).toEqual([]);
  });

  it('every accepted difference states a reason', () => {
    for (const entry of ParityHarness.ACCEPTED_DIFFERENCES) {
      expect(entry.reason.trim().length, `${entry.file} needs a reason`).toBeGreaterThan(20);
    }
  });
});

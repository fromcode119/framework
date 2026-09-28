import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RenderedCopyGuard } from '../src/rendered-copy-guard';

/**
 * Copy rendered from a `.tsx` rather than from a dictionary — read from the syntax tree, so a return
 * type is never text and an example value or a code sample is never copy.
 */
describe('RenderedCopyGuard', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
  });

  const hits = (source: string): string[] => {
    root = mkdtempSync(path.join(tmpdir(), 'rendered-copy-'));
    const file = path.join(root, 'view.tsx');
    writeFileSync(file, source);
    return RenderedCopyGuard.violationsIn(file).map((hit) => hit.replace(/^\d+: /, ''));
  };

  it('counts text between tags, spoken attributes and caption properties', () => {
    expect(hits([
      'export class A { render() { return <p title="Remove it">Delete</p>; } }',
      "export const COLUMNS = [{ label: 'Status' }];",
    ].join('\n'))).toEqual(['Remove it', 'Delete', 'Status']);
  });

  it('does not read a generic type as text between tags', () => {
    expect(hits('export class A { load = (): Promise<void> => Promise.resolve(); pick(): Partial<Record<string, number>> { return {}; } }')).toEqual([]);
  });

  it('leaves proper names, example values and quoted literals alone', () => {
    expect(hits([
      'export class A { render() { return <div>',
      '  <a>GitHub</a><span>WebP</span>',
      '  <input placeholder="name@company.com" /><input placeholder="acme.example.com, shop.acme.example.com" />',
      '  <input placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----" /><input placeholder="ABCDE-12345" />',
      '</div>; } }',
      `export const ROWS = [{ label: '"home"' }, { label: ':slug' }];`,
    ].join('\n'))).toEqual([]);
  });

  it('still counts a placeholder that has a word in it', () => {
    expect(hits('export class A { render() { return <input placeholder="e.g. laptop" />; } }')).toEqual(['e.g. laptop']);
  });

  it('does not count a key= label in front of a value', () => {
    expect(hits('export class A { render() { return <span>id={this.id} type={this.type}</span>; } }')).toEqual([]);
  });

  it('does not count a command inside <code> or <pre>', () => {
    expect(hits('export class A { render() { return <pre>npm run bundle -- --label demo</pre>; } }')).toEqual([]);
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockFieldConformanceGuard } from '../src/block-field-conformance-guard';
import { BlockFieldSourceReader } from '../src/block-field-source-reader';

/**
 * Each case is a shape a WORKING block really uses. Before these were understood the guard reported
 * 81 mismatches on the platform, of which 7 were real.
 */
describe('BlockFieldSourceReader.normalizeReads', () => {
  const reads = (src: string): string[] =>
    [...BlockFieldSourceReader.readKeys(BlockFieldSourceReader.normalizeReads(src))].sort();

  it('follows an alias of the data prop, including non-null reads', () => {
    expect(reads('const d = this.props.data;\nreturn <h2>{d!.heading}{d?.kicker}</h2>;')).toEqual(['heading', 'kicker']);
  });

  it('counts a non-null read of data itself', () => {
    expect(reads('const data = this.props.data;\n{data!.intro}')).toEqual(['intro']);
  });

  it('counts destructured keys', () => {
    expect(reads('const { data } = this.props;\nconst { title, body: text } = data;')).toEqual(['body', 'title']);
  });

  it('sees through an as-cast', () => {
    expect(reads('x((data as any)?.mediaPosition)')).toEqual(['mediaPosition']);
  });

  it('ignores import specifiers and comments', () => {
    expect(reads([
      "import type { I } from '@theme/cms/renderers/blocks/interfaces/fcs-faq-data.interface';",
      '// `data.title` was dropped.',
      '/* data.legacy */',
      'data?.heading',
    ].join('\n'))).toEqual(['heading']);
  });
});

describe('BlockFieldConformanceGuard', () => {
  let tmp = '';
  const write = (rel: string, body: string): void => {
    const full = path.join(tmp, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, body);
  };
  const run = (): { code: number; out: string } => {
    const lines: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args) => { lines.push(args.join(' ')); });
    const err = vi.spyOn(console, 'error').mockImplementation((...args) => { lines.push(args.join(' ')); });
    const code = BlockFieldConformanceGuard.run(['themes', 'plugins'], 'error');
    log.mockRestore();
    err.mockRestore();
    return { code, out: lines.join('\n') };
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  const setUp = (): void => {
    tmp = mkdtempSync(path.join(tmpdir(), 'block-conformance-'));
    mkdirSync(path.join(tmp, 'themes'));
    mkdirSync(path.join(tmp, 'plugins'));
    vi.stubEnv('ARCH_GUARD_SCOPE', '');
    vi.stubEnv('THEMES_DIR', path.join(tmp, 'themes'));
    vi.stubEnv('PLUGINS_DIR', path.join(tmp, 'plugins'));
  };

  it('does not credit a form-less block with the next static initializer\'s keys', () => {
    setUp();
    write('themes/a/src/cms/blocks/b.tsx', [
      "static readonly One = F.create({ id: 'one', fields: ['hint'] });",
      "static readonly Two = F.create({ id: 'two' });",
      'static {',
      "  X.Two.renderSettings = ({ updateData }) => updateData('caption', 1);",
      '}',
    ].join('\n'));
    write('themes/a/src/cms/renderers/one.tsx', 'const d = this.props.data; d.hint;');
    write('themes/a/src/cms/renderers/two.tsx', 'data?.caption');
    expect(run().code).toBe(0);
  });

  it('judges a block against the renderer in its own extension', () => {
    setUp();
    write('themes/a/src/cms/blocks/b.tsx', "const B = { id: 'box', renderSettings: () => updateData('heading', 1) };");
    write('themes/a/src/cms/renderers/box.tsx', 'data?.heading');
    write('themes/z/src/cms/renderers/box.tsx', 'data?.other');
    expect(run().code).toBe(0);
  });

  it('uses a declared storefront renderer over a plugin\'s own preview, and still reports a key nothing names', () => {
    setUp();
    write('plugins/cms/src/blocks/form.tsx', "const B = { id: 'lead', renderSettings: () => [updateData('heading', 1), updateData('ghost', 1)] };");
    write('plugins/cms/src/renderers/lead.tsx', 'data?.description');
    write('plugins/forms/src/ui/lead.storefront.tsx', "slots = [{ name: 'cms.block.lead' }]; this.blockText('heading');");
    const { code, out } = run();
    expect(code).toBe(1);
    expect(out).toMatch(/\[lead\].*FAKE.*ghost/);
    expect(out).not.toMatch(/heading/);
  });

  it('reports a renderer read the editor offers no control for', () => {
    setUp();
    write('plugins/cms/src/blocks/profile.tsx', "const B = { id: 'profile', renderSettings: () => updateData('name', 1) };");
    write('plugins/cms/src/renderers/profile.tsx', 'const data = this.props.data; data.name; data.role;');
    const { code, out } = run();
    expect(code).toBe(1);
    expect(out).toMatch(/MISSING.*role/);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClipboardCopy } from '@/lib/clipboard-copy';

describe('ClipboardCopy', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('says copied when the browser accepts the write', async () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('document', {});
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => undefined) } });
    expect(await ClipboardCopy.write('ORD-1')).toBe(ClipboardCopy.COPIED);
  });

  it('says failed instead of throwing when the page is not focused', async () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('document', {});
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('Document is not focused.'); }) } });
    expect(await ClipboardCopy.write('ORD-1')).toBe(ClipboardCopy.FAILED);
    expect(ClipboardCopy.labelKey(ClipboardCopy.FAILED)).toBe('collection.edit.copyFailed');
  });
});

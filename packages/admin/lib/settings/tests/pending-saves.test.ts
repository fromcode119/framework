import { describe, expect, it } from 'vitest';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';

describe('PendingSaves', () => {
  it('saves only the parts that changed, and keeps a part unsaved when its write is refused', async () => {
    const a = { value: '1', written: 0 };
    const b = { value: '1', written: 0 };
    const c = { value: '1', written: 0 };
    const partA = new PendingSave(() => a.value, async () => { a.written += 1; }, (v) => { a.value = v; });
    const partB = new PendingSave(() => b.value, async () => { b.written += 1; }, (v) => { b.value = v; });
    const partC: PendingSave = new PendingSave(() => c.value, async () => { c.written += 1; partC.failed(); }, (v) => { c.value = v; });
    [partA, partB, partC].forEach((part) => part.mark());

    expect(PendingSaves.anyDirty()).toBe(false);
    a.value = '2';
    c.value = '2';
    expect(PendingSaves.anyDirty()).toBe(true);

    await PendingSaves.saveAll();
    expect([a.written, b.written, c.written]).toEqual([1, 0, 1]);
    expect(partA.dirty).toBe(false);
    expect(partC.dirty).toBe(true);

    PendingSaves.discardAll();
    expect(c.value).toBe('1');
    expect(PendingSaves.anyDirty()).toBe(false);
    [partA, partB, partC].forEach((part) => part.dispose());
  });

  it('is not dirty before the stored values were read', () => {
    const part = new PendingSave(() => 'typed', async () => undefined, () => undefined);
    expect(part.dirty).toBe(false);
    part.dispose();
  });
});

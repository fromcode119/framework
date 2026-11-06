import { describe, expect, it } from 'vitest';
import { RequestScope } from '@/lib/request-scope';

describe('RequestScope', () => {
  it('runs a memoised fetch once per request, however many steps ask for it', async () => {
    let calls = 0;
    const read = RequestScope.memo(async (locale: string) => { calls += 1; return locale; });
    await RequestScope.run(async () => {
      await Promise.all([read('bg'), read('bg'), read('bg')]);
      await read('en');
    });
    expect(calls).toBe(2);
  });

  it('never shares a memo between two requests', async () => {
    let calls = 0;
    const read = RequestScope.memo(async () => { calls += 1; return calls; });
    await RequestScope.run(async () => { await read(); });
    await RequestScope.run(async () => { await read(); });
    expect(calls).toBe(2);
  });

  it('keys objects by identity, not by shape', async () => {
    let calls = 0;
    const read = RequestScope.memo(async (_doc: object) => { calls += 1; });
    const doc = { id: 1 };
    await RequestScope.run(async () => {
      await read(doc);
      await read(doc);
      await read({ id: 1 });
    });
    expect(calls).toBe(2);
  });
});

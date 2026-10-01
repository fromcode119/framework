import { describe, expect, it } from 'vitest';
import { ServerApiInflight } from '@/lib/server-api/server-api-inflight';

describe('ServerApiInflight', () => {
  it('counts the api calls open right now and how old the oldest is', async () => {
    expect(ServerApiInflight.describe()).toBe('none open');
    let release!: () => void;
    const pending = ServerApiInflight.track(() => new Promise<void>((resolve) => { release = resolve; }));
    const quick = ServerApiInflight.track(async () => 'done');
    expect(ServerApiInflight.describe(Date.now() + 5_000)).toMatch(/^[12] open, oldest 5\d{3} ms$/);
    await quick;
    release();
    await pending;
    expect(ServerApiInflight.describe()).toBe('none open');
  });
});

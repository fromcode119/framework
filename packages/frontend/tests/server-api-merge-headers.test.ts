import { describe, it, expect } from 'vitest';
import { ServerApiUtils } from '@/lib/server-api/server-api';

describe('ServerApiUtils.mergeHeaders', () => {
  /**
   * The bug this exists for: `{ ...new Headers({...}) }` is `{}`. A `Headers` instance has no own
   * enumerable properties, so the same-origin proxy's carefully built headers — content-type,
   * cookie, CSRF — were dropped on every POST, silently.
   */
  it('keeps headers passed as a Headers instance', () => {
    const merged = ServerApiUtils.mergeHeaders(
      { host: 'shop.example.com' },
      new Headers({ 'content-type': 'application/json', cookie: 'fc_token=abc' }),
    );

    expect(merged['content-type']).toBe('application/json');
    expect(merged.cookie).toBe('fc_token=abc');
    expect(merged.host).toBe('shop.example.com');
  });

  it('keeps headers passed as a plain object', () => {
    const merged = ServerApiUtils.mergeHeaders({ host: 'a' }, { 'x-csrf-token': 't' });
    expect(merged['x-csrf-token']).toBe('t');
  });

  it('keeps headers passed as an array of pairs', () => {
    const merged = ServerApiUtils.mergeHeaders({ host: 'a' }, [['x-one', '1']]);
    expect(merged['x-one']).toBe('1');
  });

  /** The caller's value wins: it knows what this specific request is sending. */
  it('lets the caller override a forwarded header', () => {
    const merged = ServerApiUtils.mergeHeaders({ host: 'forwarded' }, new Headers({ host: 'explicit' }));
    expect(merged.host).toBe('explicit');
  });

  it('returns the forwarded headers unchanged when there are none to merge', () => {
    expect(ServerApiUtils.mergeHeaders({ host: 'a' })).toEqual({ host: 'a' });
  });
});

import { describe, expect, it } from 'vitest';
import { RequestContextUtils } from '@fromcode119/core';
import { SessionUserContextMiddleware } from '@api/middlewares/session-user-context-middleware';

describe('SessionUserContextMiddleware', () => {
  const run = (user: unknown) => RequestContextUtils.storage.run({} as any, () => {
    let seen: string | undefined;
    new SessionUserContextMiddleware().middleware()({ user }, {}, () => { seen = RequestContextUtils.getSessionUserId(); });
    return seen;
  });

  it('records the signed-in account on the request context', () => {
    expect(run({ id: 7 })).toBe('7');
  });

  it('records nothing for an anonymous request', () => {
    expect(run(undefined)).toBeUndefined();
    expect(run({ id: '  ' })).toBeUndefined();
  });

  it('calls on outside a request context', () => {
    let called = false;
    new SessionUserContextMiddleware().middleware()({ user: { id: 7 } }, {}, () => { called = true; });
    expect(called).toBe(true);
  });
});

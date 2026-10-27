import { beforeEach, describe, expect, it } from 'vitest';
import { ApiOutcomeCounter } from '@core/monitoring/api-outcome-counter';

describe('ApiOutcomeCounter', () => {
  beforeEach(() => { ApiOutcomeCounter.drain(); });

  it('folds record ids and tokens out of a route, and drops the query', () => {
    expect(ApiOutcomeCounter.route('get', '/api/orders/42/items?secret=x')).toBe('GET /api/orders/:id/items');
    expect(ApiOutcomeCounter.route('GET', '/api/people/3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('GET /api/people/:id');
    expect(ApiOutcomeCounter.route('GET', '/api/reset/eyJhbGciOiJIUzI1NiJ9abc123def456')).toBe('GET /api/reset/:id');
    expect(ApiOutcomeCounter.route('GET', '/api/system/frontend')).toBe('GET /api/system/frontend');
  });

  it('attributes only server errors, keeps the top five, and starts a fresh window on drain', () => {
    for (let i = 1; i <= 7; i += 1) for (let n = 0; n < i; n += 1) ApiOutcomeCounter.record(500, 'GET', `/r${i}`);
    ApiOutcomeCounter.record(404, 'GET', '/missing');
    const first = ApiOutcomeCounter.drain();
    expect(first.total).toBe(29);
    expect(first.errors).toBe(28);
    expect(first.failing.map((f) => f.route)).toEqual(['GET /r7', 'GET /r6', 'GET /r5', 'GET /r4', 'GET /r3']);
    expect(ApiOutcomeCounter.drain()).toEqual({ total: 0, errors: 0, failing: [] });
  });

  it('counts a deliberate refusal as answered, not failed', () => {
    const privateSite = {};
    ApiOutcomeCounter.refused(privateSite);
    ApiOutcomeCounter.record(503, 'GET', '/api/system/resolve', ApiOutcomeCounter.isRefusal(privateSite));
    ApiOutcomeCounter.record(503, 'GET', '/api/system/resolve', ApiOutcomeCounter.isRefusal({}));
    const window = ApiOutcomeCounter.drain();
    expect(window.total).toBe(2);
    expect(window.errors).toBe(1);
    expect(window.failing).toEqual([{ route: 'GET /api/system/resolve', count: 1 }]);
  });
});

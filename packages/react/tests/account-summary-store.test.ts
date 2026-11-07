import { describe, expect, it, vi } from 'vitest';
import { AccountSummaryStore } from '@react/account/account-summary-store';

describe('AccountSummaryStore', () => {
  it('merges contributors per section without one erasing another', () => {
    AccountSummaryStore.set([
      { sections: { security: { text: 'Two-factor sign-in: off' } } },
      { who: 'Customer since 2023', sections: { orders: { count: 3 }, addresses: { count: 2, text: '2 addresses' } } },
      { who: 'ignored, the first wins', sections: { orders: { text: '1 on its way' } } },
    ]);
    expect(AccountSummaryStore.get().who).toBe('Customer since 2023');
    expect(AccountSummaryStore.section('orders')).toEqual({ count: 3, text: '1 on its way' });
    expect(AccountSummaryStore.section('security')?.text).toBe('Two-factor sign-in: off');
    expect(AccountSummaryStore.section('missing')).toBeUndefined();
  });

  it('tells subscribers when the summaries change, and stops after unsubscribe', () => {
    const listener = vi.fn();
    const stop = AccountSummaryStore.subscribe(listener);
    AccountSummaryStore.set([{ sections: { orders: { count: 1 } } }]);
    stop();
    AccountSummaryStore.set([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('runs every registered reloader on reload, and stops after unregistering', () => {
    const reloader = vi.fn();
    const stop = AccountSummaryStore.onReload(reloader);
    AccountSummaryStore.reload();
    stop();
    AccountSummaryStore.reload();
    expect(reloader).toHaveBeenCalledTimes(1);
  });
});

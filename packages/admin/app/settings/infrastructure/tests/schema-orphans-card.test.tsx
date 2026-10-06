// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('@/lib/api', () => ({
  AdminApi: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

import type { ReactElement } from 'react';
import { SchemaOrphansCard } from '@/app/settings/infrastructure/schema-orphans-card.client';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';

const notify = vi.fn();
const mount = (ui: ReactElement) =>
  render(
    <AdminRuntimeContext.context.Provider value={{ notify: { addNotification: vi.fn(), notify }, globalSettings: {}, collections: [], plugins: { collections: [] } } as any}>
      {ui}
    </AdminRuntimeContext.context.Provider>,
  );

const empty = { table: 'fcp_shop_items', column: 'legacy_flag', rows: 12, nonEmpty: 0, firstSeenAt: '2026-10-01T08:00:00.000Z' };
const holding = { table: 'fcp_shop_orders', column: 'old_ref', rows: 40, nonEmpty: 31, sample: 'A-1042', firstSeenAt: '2026-10-02T08:00:00.000Z', inactivePluginsAtScan: ['licensing'] };
const uncounted = { table: 'fcp_shop_carts', column: 'token', firstSeenAt: '2026-10-03T08:00:00.000Z' };

/**
 * The schema review shows what each undeclared column still holds, never turns "could not count" into
 * a zero, and drops nothing until the operator confirms.
 */
describe('SchemaOrphansCard', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    notify.mockReset();
  });

  it('lists each column with what it still holds, and says so when it could not be counted', async () => {
    apiGet.mockResolvedValue({ columns: [empty, holding, uncounted] });
    mount(<SchemaOrphansCard />);

    expect(await screen.findByText('fcp_shop_items.legacy_flag')).toBeTruthy();
    expect(screen.getByText(/holds no value in any of its 12 row/i)).toBeTruthy();
    expect(screen.getByText(/31 of 40 row\(s\) hold a value/i)).toBeTruthy();
    expect(screen.getByText(/A-1042/)).toBeTruthy();
    expect(screen.getByText(/licensing/)).toBeTruthy();
    // the uncounted one is NOT shown as empty
    expect(screen.getByText(/could not be counted/i)).toBeTruthy();
    expect(screen.queryAllByText(/holds no value/i)).toHaveLength(1);
  });

  it('says there is nothing to review when the queue is empty', async () => {
    apiGet.mockResolvedValue({ columns: [] });
    mount(<SchemaOrphansCard />);
    expect(await screen.findByText(/no undeclared columns/i)).toBeTruthy();
  });

  it('says the list could not be loaded instead of showing an empty queue', async () => {
    apiGet.mockRejectedValue(new Error('forbidden'));
    mount(<SchemaOrphansCard />);
    expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
    expect(screen.queryByText(/no undeclared columns/i)).toBeNull();
  });

  it('drops nothing on click, asks first, and posts exactly that column on confirm', async () => {
    apiGet.mockResolvedValueOnce({ columns: [holding] }).mockResolvedValueOnce({ columns: [] });
    apiPost.mockResolvedValue({ dropped: holding });
    mount(<SchemaOrphansCard />);

    fireEvent.click(await screen.findByRole('button', { name: /drop column/i }));
    expect(apiPost).not.toHaveBeenCalled();
    expect(await screen.findByText(/removed from the database for every site, permanently/i)).toBeTruthy();
    expect(screen.getAllByText(/31 of 40/).length).toBeGreaterThan(1);

    const confirmButtons = screen.getAllByRole('button', { name: /drop column/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls[0][1]).toEqual({ table: 'fcp_shop_orders', column: 'old_ref' });
    expect(await screen.findByText(/no undeclared columns/i)).toBeTruthy();
  });

  it('keeps the column listed and says so when the drop fails', async () => {
    apiGet.mockResolvedValue({ columns: [empty] });
    apiPost.mockRejectedValue(new Error('lock timeout'));
    mount(<SchemaOrphansCard />);

    fireEvent.click(await screen.findByRole('button', { name: /drop column/i }));
    const buttons = await screen.findAllByRole('button', { name: /drop column/i });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(notify.mock.calls.at(-1)?.[1]).toMatch(/could not be dropped/i);
    expect(screen.getByText('fcp_shop_items.legacy_flag')).toBeTruthy();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AuditTrailCard } from '@/app/settings/security/audit-trail-card';

/** The excluded tables show as their plugin and collection, and are added by name from the plugins' tables. */
describe('Settings -> Security -> Audit Trail', () => {
  it('names stored tables by plugin and collection and offers the rest by name', async () => {
    vi.spyOn(AdminApi, 'get').mockResolvedValue({ tables: [
      { table: 'fcp_analytics_events', plugin: 'analytics', collection: 'events' },
      { table: 'fcp_cms_pages', plugin: 'cms', collection: 'pages' },
    ] });
    render(
      <AuditTrailCard
        settings={{ [SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES]: 'fcp_analytics_events' }}
        setSettings={vi.fn()}
        theme={ThemeMode.LIGHT}
      />,
    );
    await waitFor(() => expect(screen.getByText('Analytics · Events')).toBeDefined());
    expect(screen.getByText('fcp_analytics_events')).toBeDefined();
    expect(screen.getByText('Add by name…')).toBeDefined();
  });

  it('sets nothing when the card is gone before the table list arrives', async () => {
    let answer: (value: unknown) => void = () => undefined;
    vi.spyOn(AdminApi, 'get').mockReturnValue(new Promise((resolve) => { answer = resolve; }) as never);
    const setState = vi.spyOn(AuditTrailCard.prototype as any, 'setState');
    const { unmount } = render(
      <AuditTrailCard settings={{}} setSettings={vi.fn()} theme={ThemeMode.LIGHT} />,
    );
    unmount();
    answer({ tables: [{ table: 'fcp_cms_pages', plugin: 'cms', collection: 'pages' }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(setState).not.toHaveBeenCalled();
  });
});

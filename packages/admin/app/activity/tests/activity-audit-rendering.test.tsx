import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeMode } from '@fromcode119/core/client';
import { ActivityDetailModal } from '@/app/activity/activity-detail-modal';
import { ActivityColumnsFactory } from '@/app/activity/activity-columns';
import { ActivityMode } from '@/app/activity/enums/activity-mode.enum';

/**
 * The Activity screen against the rows the API actually returns.
 *
 * Both endpoints return camelCase keys (`pluginSlug`), and a security-audit row has no `level` —
 * the modal must not crash on it, and the plugin column must not label every plugin row "System".
 * Audit resources are `table` or `table/id` (e.g. `fcp_beta_products/8`) with the method in
 * metadata; the detail view has to surface both.
 */

/** A security-audit row exactly as GET /system/admin/audit serves it. */
const auditRow = {
  id: 41,
  pluginSlug: 'beta',
  action: 'Database Write',
  resource: 'fcp_beta_products/8',
  status: 'allowed',
  metadata: '{"method":"update"}',
  createdAt: '2026-08-18T12:00:00.000Z',
};

/** A system-log row exactly as GET /system/admin/logs serves it. */
const logRow = {
  id: 7,
  pluginSlug: 'theta',
  level: 'INFO',
  message: 'submission stored',
  context: null,
  timestamp: '2026-08-18T12:00:00.000Z',
};

describe('Activity screen renders API rows', () => {
  it('the detail modal renders an audit row (which has no level) without crashing', () => {
    render(
      <ActivityDetailModal
        selectedLog={auditRow}
        mode={ActivityMode.SECURITY}
        theme={ThemeMode.LIGHT}
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText('fcp_beta_products/8')).toBeTruthy();
    expect(screen.getByText('Database Write')).toBeTruthy();
  });

  it('the detail modal shows the audited method from the row metadata', () => {
    render(
      <ActivityDetailModal
        selectedLog={auditRow}
        mode={ActivityMode.SECURITY}
        theme={ThemeMode.LIGHT}
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText(/"method": "update"/)).toBeTruthy();
  });

  it('the modal names the plugin that acted, not "System", for a plugin audit row', () => {
    render(
      <ActivityDetailModal
        selectedLog={auditRow}
        mode={ActivityMode.SECURITY}
        theme={ThemeMode.LIGHT}
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('the security columns name the plugin that acted, not "System"', () => {
    const columns = ActivityColumnsFactory.security(ThemeMode.LIGHT);
    const pluginColumn = columns.find((c: any) => c.id === 'plugin') as any;

    render(<>{pluginColumn.accessor(auditRow)}</>);

    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.queryByText('System')).toBeNull();
  });

  it('the system columns name the plugin that logged, not "System"', () => {
    const columns = ActivityColumnsFactory.system(ThemeMode.LIGHT);
    const resourceColumn = columns.find((c: any) => c.id === 'target') as any;

    render(<>{resourceColumn.accessor(logRow)}</>);

    expect(screen.getByText('Theta')).toBeTruthy();
    expect(screen.queryByText('System')).toBeNull();
  });
});

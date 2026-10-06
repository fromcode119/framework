// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VersionChangeSummary } from '@/components/collection/version-change-summary';
import { SidebarVersions } from '@/components/collection/edit/view/sidebar-versions.client';

const fields = [
  { name: 'status', label: 'Status' },
  { name: 'totalAmount', label: 'Total' },
  { name: 'notes', label: 'Notes' },
];

/**
 * The history said "Update fcp_finance_invoices record" twice and nothing else, so two versions could not be
 * told apart without restoring one. Each version now says what it changed from the one before it.
 */
describe('VersionChangeSummary', () => {
  it('lists the fields that differ, with the admin labels, and ignores what the platform maintains', () => {
    const older = { id: 7, status: 'issued', totalAmount: 30, notes: '', updatedAt: '2026-09-04T08:19:00Z' };
    const newer = { id: 7, status: 'cancelled', totalAmount: 30, notes: 'voided', updatedAt: '2026-09-04T15:35:00Z' };
    expect(VersionChangeSummary.between(newer, older, fields)).toEqual([
      { label: 'Status', from: 'issued', to: 'cancelled' },
      { label: 'Notes', from: '—', to: 'voided' },
    ]);
  });

  it('reads snake_case and camelCase as the same field', () => {
    const changes = VersionChangeSummary.between({ total_amount: 0 }, { totalAmount: 30 }, fields);
    expect(changes).toEqual([{ label: 'Total', from: '30', to: '0' }]);
  });

  it('says there is nothing to compare with for the first version, and reports an unchanged pair as empty', () => {
    expect(VersionChangeSummary.between({ status: 'issued' }, null, fields)).toBeNull();
    expect(VersionChangeSummary.between({ status: 'issued' }, { status: 'issued' }, fields)).toEqual([]);
  });

  it('shows the changes under each version in the history, and Created on the oldest', () => {
    const revisions = [
      { id: 2, version: 2, date: new Date('2026-09-04T15:35:00Z'), user: 'kristian', action: 'Update fcp_finance_invoices record', changes: { status: 'cancelled', totalAmount: 30 } },
      { id: 1, version: 1, date: new Date('2026-09-04T08:19:00Z'), user: 'kristian', action: 'Update fcp_finance_invoices record', changes: { status: 'issued', totalAmount: 30 } },
    ];
    render(
      <SidebarVersions revisions={revisions} revisionsLoading={false} activeVersionId={2} setSelectedRevision={vi.fn()} setFormData={vi.fn()}
        setActiveVersionId={vi.fn()} loadMoreRevisions={vi.fn()} hasMoreRevisions={false} formData={{}} fields={fields} />,
    );
    expect(screen.getByText('Status:')).toBeTruthy();
    expect(screen.getByText('cancelled')).toBeTruthy();
    expect(screen.getByText(/^Created$/)).toBeTruthy();
  });

  it('shows no guess for the oldest loaded version while earlier ones may still exist', () => {
    const revisions = [
      { id: 2, version: 2, date: new Date(), user: 'a', action: 'Update', changes: { status: 'b' } },
      { id: 1, version: 1, date: new Date(), user: 'a', action: 'Update', changes: { status: 'a' } },
    ];
    render(
      <SidebarVersions revisions={revisions} revisionsLoading={false} activeVersionId={2} setSelectedRevision={vi.fn()} setFormData={vi.fn()}
        setActiveVersionId={vi.fn()} loadMoreRevisions={vi.fn()} hasMoreRevisions={true} formData={{}} fields={fields} />,
    );
    expect(screen.queryByText(/^Created$/)).toBeNull();
  });
});

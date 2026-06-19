import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { VersionHistoryList } from './version-history-list';
import { VersionRevisionModal } from './version-revision-modal';
import type { Version, VersionHistoryProps, VersionHistoryState } from './version-history.interfaces';

export class VersionHistory extends React.Component<VersionHistoryProps, VersionHistoryState> {
  state: VersionHistoryState = { revisions: [], loading: false, hasMore: false, page: 1, selectedRevision: null };

  private fetchRevisions = async (p: number): Promise<void> => {
    const { recordId, collectionSlug } = this.props;
    this.setState({ loading: true });
    try {
      const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/versions?ref_id=${recordId}&ref_collection=${collectionSlug}&sort=-id&limit=10&page=${p}`);

      const mapped: Version[] = (result.docs || []).map((v: any) => ({
        id: v.id,
        version: v.version || 1,
        date: new Date(v.created_at || v.createdAt),
        user: v.updated_by || v.updatedBy || 'System',
        action: v.change_summary || 'Update',
        changes: v.version_data
      }));

      if (p === 1) {
        this.setState({ revisions: mapped });
      } else {
        this.setState(prev => ({ revisions: [...prev.revisions, ...mapped] }));
      }

      this.setState({ hasMore: result.hasNextPage || (result.docs?.length === 10) });
    } catch (err) {
      console.error("Failed to fetch revisions:", err);
    } finally {
      this.setState({ loading: false });
    }
  };

  componentDidMount(): void {
    const { recordId, collectionSlug } = this.props;
    if (recordId && collectionSlug) void this.fetchRevisions(1);
  }

  componentDidUpdate(prevProps: VersionHistoryProps): void {
    const { recordId, collectionSlug } = this.props;
    if ((prevProps.recordId !== recordId || prevProps.collectionSlug !== collectionSlug) && recordId && collectionSlug) {
      void this.fetchRevisions(1);
    }
  }

  private loadMore = (): void => {
    const nextPage = this.state.page + 1;
    this.setState({ page: nextPage });
    void this.fetchRevisions(nextPage);
  };

  render(): React.ReactNode {
    const { onRestore, activeVersionId, theme } = this.props;
    const { revisions, loading, hasMore, selectedRevision } = this.state;
    const setSelectedRevision = (v: Version | null) => this.setState({ selectedRevision: v });
    const currentRevIndex = selectedRevision ? revisions.findIndex(r => r.id === selectedRevision.id) : -1;

    return (
    <>
      <VersionHistoryList
        revisions={revisions}
        loading={loading}
        hasMore={hasMore}
        activeVersionId={activeVersionId}
        onSelect={setSelectedRevision}
        onRestore={onRestore}
        onLoadMore={this.loadMore}
      />

      {selectedRevision && (
        <VersionRevisionModal
          selectedRevision={selectedRevision}
          revisions={revisions}
          currentRevIndex={currentRevIndex}
          theme={theme}
          onSelect={setSelectedRevision}
          onRestore={onRestore}
        />
      )}
    </>
    );
  }
}

import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { state, bound, watch } from '@fromcode119/react-class-components';
import { ActivityMode } from '@/app/activity/enums/activity-mode.enum';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ActivityColumnsFactory } from '@/app/activity/activity-columns';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { Tabs } from '@/components/ui/view/tabs.client';
import { SearchField } from '@/components/ui/view/search-field.client';
import { ActivityDetailModal } from '@/app/activity/activity-detail-modal';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class ActivityPage extends AdminComponent {
  private readonly limit = 50;
  private mounted = false;
  /** The pause after the last keystroke before the list is asked again. */
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  @state mode: ActivityMode = ActivityMode.SYSTEM;
  @state logs: any[] = [];
  @state loading = true;
  @state page = 1;
  @state totalDocs = 0;
  @state searchQuery = '';
  @state activeSearch = '';
  @state selectedLog: any = null;

  componentDidMount(): void {
    this.mounted = true;

    const searchParams = new URLSearchParams(window.location.search);
    const userFilter = searchParams.get('user');
    const modeParam = searchParams.get('mode');

    if (userFilter && !this.searchQuery) {
      this.searchQuery = userFilter;
      this.activeSearch = userFilter;
    }

    if (modeParam === 'security') {
      this.mode = ActivityMode.SECURITY;
    }

    void this.loadLogs();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  @watch('page', 'activeSearch', 'mode') reloadLogs(): void {
    void this.loadLogs();
  }

  private async loadLogs(): Promise<void> {
    this.loading = true;
    try {
      const endpoint = this.mode === ActivityMode.SYSTEM ? AdminConstants.ENDPOINTS.SYSTEM.LOGS : AdminConstants.ENDPOINTS.SYSTEM.AUDIT;
      const response = await AdminApi.get(`${endpoint}?page=${this.page}&limit=${this.limit}&search=${this.activeSearch}`);
      if (!this.mounted) return;
      this.logs = response.docs || [];
      this.totalDocs = response.totalDocs || 0;
    } catch (error) {
      console.error(`Failed to fetch ${this.mode} logs:`, error);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  @bound handleExportJSON(log: any): void {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(log, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `log-${log.id || 'export'}-${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  @bound handleModeChange(id: string): void {
    this.mode = id === 'security' ? ActivityMode.SECURITY : ActivityMode.SYSTEM;
    this.page = 1;
  }

  /** The list follows the field: it is asked again once the typing pauses, from its first page. */
  @bound handleSearchQueryChange(value: string): void {
    this.searchQuery = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.activeSearch = this.searchQuery;
    }, 300);
  }

  @bound handlePageChange(nextPage: number): void {
    this.page = nextPage;
  }

  @bound handleRowClick(log: any): void {
    this.selectedLog = log;
  }

  @bound handleCloseDetail(): void {
    this.selectedLog = null;
  }

  private get columns(): any[] {
    return this.mode === ActivityMode.SYSTEM
      ? ActivityColumnsFactory.system()
      : ActivityColumnsFactory.security();
  }

  render(): ReactNode {
    const theme = this.theme;
    return (
      <div className="w-full flex flex-col animate-in fade-in duration-500">
        <ListShell
          title={AdminI18n.t('nav.items.activity')}
          lead={(
            <Tabs
              label={AdminI18n.t('nav.items.activity')}
              value={this.mode === ActivityMode.SYSTEM ? 'system' : 'security'}
              onChange={this.handleModeChange}
              tabs={[{ id: 'system', label: AdminI18n.t('activity.systemEvents') }, { id: 'security', label: AdminI18n.t('activity.securityAudit') }]}
            />
          )}
          tools={<SearchField value={this.searchQuery} onChange={this.handleSearchQueryChange} placeholder={AdminI18n.t('shell.nav.search')} />}
        >
          <DataTable
            columns={this.columns}
            data={this.logs}
            totalDocs={this.totalDocs}
            limit={this.limit}
            page={this.page}
            onPageChange={this.handlePageChange}
            onRowClick={this.handleRowClick}
            emptyMessage={this.loading ? AdminI18n.t('activity.decryptingAuditLedger') : AdminI18n.t('activity.noAuditRecordsDocumented')}
          />
        </ListShell>

        {this.selectedLog && (
          <ActivityDetailModal
            selectedLog={this.selectedLog}
            mode={this.mode}
            theme={theme}
            onClose={this.handleCloseDetail}
            onExport={this.handleExportJSON}
          />
        )}
      </div>
    );
  }
}

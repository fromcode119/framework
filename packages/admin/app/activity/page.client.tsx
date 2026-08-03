import { ThemeMode } from '@fromcode119/core/client';
import type { FormEvent, ReactNode } from 'react';
import { state, bound, watch } from '@fromcode119/reactor';
import { ActivityMode } from '@/app/activity/enums/activity-mode.enum';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { AdminPageFooter } from '@/components/ui/view/admin-page-footer.client';
import { ActivityColumnsFactory } from '@/app/activity/activity-columns';
import { ActivityPageHeader } from '@/app/activity/activity-page-header';
import { ActivityDetailModal } from '@/app/activity/activity-detail-modal';

export class ActivityPage extends AdminComponent {
  private readonly limit = 50;
  private mounted = false;

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

  @bound handleSearch(e: FormEvent): void {
    e.preventDefault();
    this.page = 1;
    this.activeSearch = this.searchQuery;
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

  @bound handleModeChange(nextMode: ActivityMode): void {
    this.mode = nextMode;
    this.page = 1;
  }

  @bound handleSearchQueryChange(value: string): void {
    this.searchQuery = value;
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
      ? ActivityColumnsFactory.system(this.theme)
      : ActivityColumnsFactory.security(this.theme);
  }

  render(): ReactNode {
    const theme = this.theme;
    return (
      <div className="w-full pb-24 animate-in fade-in duration-500">
        <ActivityPageHeader
          mode={this.mode}
          theme={theme}
          searchQuery={this.searchQuery}
          onModeChange={this.handleModeChange}
          onSearchQueryChange={this.handleSearchQueryChange}
          onSearch={this.handleSearch}
        />

        <div className="w-full px-6 lg:px-12 pt-12 space-y-8 pb-12">
          <div className={`${AdminClass.SURFACE} overflow-hidden`}>
            <DataTable
              columns={this.columns}
              data={this.logs}
              totalDocs={this.totalDocs}
              limit={this.limit}
              page={this.page}
              onPageChange={this.handlePageChange}
              onRowClick={this.handleRowClick}
              emptyMessage={this.loading ? "Decrypting audit ledger..." : "No audit records documented"}
            />
          </div>
        </div>

        {this.selectedLog && (
          <ActivityDetailModal
            selectedLog={this.selectedLog}
            mode={this.mode}
            theme={theme}
            onClose={this.handleCloseDetail}
            onExport={this.handleExportJSON}
          />
        )}

        <AdminPageFooter
          label="System Activity Log"
          description="Global ledger of administrative actions and system events."
          accent="emerald"
          links={[
            { label: 'Users', href: AdminConstants.ROUTES.USERS.LIST },
            { label: 'Roles', href: AdminConstants.ROUTES.USERS.ROLE_LIST },
            { label: 'Permissions', href: AdminConstants.ROUTES.USERS.PERMISSIONS },
          ]}
        />
      </div>
    );
  }
}

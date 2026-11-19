import { Tabs } from '@/components/ui/view/tabs.client';
import { SearchField } from '@/components/ui/view/search-field.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { ActivityMode } from '@/app/activity/enums/activity-mode.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Input } from '@/components/ui/view/input.client';

export class ActivityPageHeader extends PureReactor {
  @prop declare mode: ActivityMode;
  @prop declare theme: ThemeMode;
  @prop declare searchQuery: string;
  @prop declare onModeChange: (mode: ActivityMode) => void;
  @prop declare onSearchQueryChange: (value: string) => void;
  @prop declare onSearch: (e: FormEvent) => void;

  @bound
  protected selectSystemMode(): void {
    this.onModeChange(ActivityMode.SYSTEM);
  }

  @bound
  protected selectSecurityMode(): void {
    this.onModeChange(ActivityMode.SECURITY);
  }

  @bound
  protected changeSearchQuery(e: ChangeEvent<HTMLInputElement>): void {
    this.onSearchQueryChange(e.target.value);
  }

  render(): ReactNode {
    const mode = this.mode;
    const theme = this.theme;
    return (
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Activity size={18} strokeWidth={2.5} />}
        title={mode === ActivityMode.SYSTEM ? AdminI18n.t('activity.systemActivity') : AdminI18n.t('activity.securityAudit')}
        subtitle={AdminI18n.t('activity.globalLedgerOfAdministrativeActions')}
        actions={
          <>
            <Tabs value={mode === ActivityMode.SYSTEM ? 'system' : 'security'} onChange={(id: string) => (id === 'system' ? this.selectSystemMode() : this.selectSecurityMode())}
              tabs={[{ id: 'system', label: AdminI18n.t('activity.systemEvents') }, { id: 'security', label: AdminI18n.t('activity.securityAudit') }]} />
            <form onSubmit={this.onSearch} className="fc-page-header__search">
              <SearchField placeholder={AdminI18n.t('activity.searchLogs', { mode: mode })} value={this.searchQuery} onChange={this.onSearchQueryChange} />
              <Button type="submit" variant={ButtonVariant.SECONDARY}>{AdminI18n.t('activity.filterHistory')}</Button>
            </form>
          </>
        }
      />
    );
  }
}

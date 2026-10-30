import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The page's header — the same compact header every settings page has. Its one everyday action is Save,
 * while a provider form is open; resetting cached admin JavaScript is not everyday, so it sits in ⋯.
 */
export class IntegrationHeader extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<IntegrationHeader, 'theme' | 'formId' | 'saving' | 'resettingStaleJs' | 'onResetStaleJs'>;

  @prop declare theme: ThemeMode;
  /** The open provider form's id, or empty when nothing is open: Save submits that form. */
  @prop declare formId: string;
  @prop declare saving: boolean;
  @prop declare resettingStaleJs: boolean;
  @prop declare onResetStaleJs: () => void;

  private renderActions(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className="flex items-center gap-2">
        {this.formId ? (
          <Button type="submit" form={this.formId} isLoading={this.saving}
            icon={<FrameworkIcons.Save size={15} strokeWidth={2} />}
            className="h-9 px-4 rounded-lg font-semibold text-xs text-white">
            {AdminI18n.t('settings.integrations.save')}
          </Button>
        ) : null}
        <Dropdown align={HorizontalAlign.RIGHT} items={[{
          label: AdminI18n.t('settings.integrations.resetStaleJs'),
          icon: this.resettingStaleJs ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Refresh size={14} />,
          onClick: this.onResetStaleJs,
        }]} trigger={
          <span aria-label={AdminI18n.t('settings.integrations.more')} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <FrameworkIcons.More size={16} />
          </span>
        } />
      </div>
    );
  }

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.theme}
        icon={<FrameworkIcons.Plugins size={18} strokeWidth={2} />}
        title={AdminI18n.t('settings.integrations.integrations')}
        subtitle={AdminI18n.t('settings.integrations.pageSubtitle')}
        actions={this.renderActions()}
      />
    );
  }
}

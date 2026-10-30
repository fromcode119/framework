import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminLink } from '@/components/view/admin-link.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The page's header, built like a plugin's settings header: where you are, what the page is, and the one
 * everyday action — Save, while a provider form is open. Resetting cached admin JavaScript is not an
 * everyday action, so it sits in the ⋯ menu.
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

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div>
        <div className={`mb-2 flex items-center gap-1.5 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          <AdminLink href={AdminConstants.ROUTES.SETTINGS.GENERAL} className={`hover:underline ${dark ? 'hover:text-slate-300' : 'hover:text-slate-600'}`}>
            {AdminI18n.t('settings.integrations.breadcrumbSettings')}
          </AdminLink>
          <span>/</span>
          <span>{AdminI18n.t('settings.integrations.integrations')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${dark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
            <FrameworkIcons.Plugins size={20} />
          </div>
          <div className="min-w-[12rem] flex-1">
            <h1 className={`truncate text-xl font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('settings.integrations.integrations')}</h1>
            <p className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{AdminI18n.t('settings.integrations.pageSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {this.formId ? (
              <button type="submit" form={this.formId} disabled={this.saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                {this.saving ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Check size={14} />}
                {this.saving ? AdminI18n.t('settings.integrations.saving') : AdminI18n.t('settings.integrations.save')}
              </button>
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
        </div>
      </div>
    );
  }
}

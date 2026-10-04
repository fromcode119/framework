import { ThemeMode, LocalizationUtils } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { DetailBox } from '@/components/view/detail-box.client';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The layouts the theme offers, the one pages get when they choose none marked as the default. Absent when it offers none. */
export class ThemeOverviewLayouts extends PureReactor {
  @prop declare layouts: NonNullable<ITheme['layouts']>;
  /** The site's saved default, else the theme's own; empty when neither names one. */
  @prop declare defaultLayout: string;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    if (!this.layouts.length) return null;
    const dark = this.theme === ThemeMode.DARK;
    return (
      <DetailBox title={AdminI18n.t('themes.layoutsTitle')} theme={this.theme}>
        <ul className={`space-y-1 text-[13px] ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
          {this.layouts.map((layout) => (
            <li key={layout.name}>
              {LocalizationUtils.resolveLabelText(layout.label, AdminI18n.locale) || layout.name}
              {layout.name === this.defaultLayout ? <span className={dark ? 'text-slate-500' : 'text-slate-400'}> — {AdminI18n.t('themes.layoutDefault')}</span> : null}
            </li>
          ))}
        </ul>
      </DetailBox>
    );
  }
}

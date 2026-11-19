import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Badge } from '@/components/ui/view/badge.client';
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
    return (
      <ListShell title={AdminI18n.t('themes.layoutsTitle')} count={this.layouts.length}>
        <div>
          {this.layouts.map((layout) => (
            <ListRow key={layout.name}
              title={LocalizationUtils.resolveLabelText(layout.label, AdminI18n.locale) || layout.name}
              badges={layout.name === this.defaultLayout ? <Badge>{AdminI18n.t('themes.layoutDefault')}</Badge> : undefined}
              meta={layout.name} />
          ))}
        </div>
      </ListShell>
    );
  }
}

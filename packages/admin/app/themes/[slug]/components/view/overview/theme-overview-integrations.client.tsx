import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { DetailBox } from '@/components/view/detail-box.client';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The integrations the theme declares it needs, each linking to where it is configured. Absent when it declares none. */
export class ThemeOverviewIntegrations extends PureReactor {
  @prop declare integrations: NonNullable<ITheme['integrationRequirements']>;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    if (!this.integrations.length) return null;
    const dark = this.theme === ThemeMode.DARK;
    return (
      <DetailBox title={AdminI18n.t('themes.integrationRequirements')} theme={this.theme}>
        {this.integrations.map((integration) => (
          <div key={integration.type} className={`flex flex-wrap items-center gap-3 border-t py-2.5 first:border-t-0 ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-medium ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{integration.label || integration.type}</div>
              <div className={`mt-0.5 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                {integration.description || AdminI18n.t('themes.configureIntegrationForThisTheme', { type: integration.type })}
              </div>
            </div>
            <Badge variant={integration.required === false ? 'gray' : 'warning'}>
              {integration.required === false ? AdminI18n.t('themes.optional') : AdminI18n.t('themes.required')}
            </Badge>
            <Link href={AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(integration.type)} className="text-[13px] font-medium text-indigo-500 hover:underline">
              {AdminI18n.t('themes.openIntegrationSettings')}
            </Link>
          </div>
        ))}
      </DetailBox>
    );
  }
}

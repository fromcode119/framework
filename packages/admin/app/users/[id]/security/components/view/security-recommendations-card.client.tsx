import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class SecurityRecommendationsCard extends PureReactor {
  @prop declare isAdministrator: boolean;
  @prop declare isDark: boolean;
  @prop declare twoFactorEnabled: boolean;

  render(): ReactNode {
    const { isAdministrator, isDark, twoFactorEnabled } = this;
    return (
      <Card title={AdminI18n.t('users.securityRecommendations')} icon={<FrameworkIcons.Shield size={18} className="text-amber-500" />}>
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3"><div className={`h-8 w-8 rounded-xl flex items-center justify-center ${twoFactorEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}><FrameworkIcons.ShieldCheck size={16} /></div><div className="flex-1"><h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('users.twoFactorAuthentication')}</h4><p className="text-xs text-slate-500 mt-1">{twoFactorEnabled ? AdminI18n.t('users.activeAndProtectingThisAccount') : AdminI18n.t('users.notEnabledHighlyRecommendedFor')}</p></div></div>
          <div className="flex items-start gap-3"><div className="h-8 w-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500"><FrameworkIcons.Check size={16} /></div><div className="flex-1"><h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('users.passwordProtected')}</h4><p className="text-xs text-slate-500 mt-1">{AdminI18n.t('users.accountHasASecurePassword')}</p></div></div>
          {isAdministrator ? <div className="flex items-start gap-3"><div className="h-8 w-8 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500"><FrameworkIcons.Shield size={16} /></div><div className="flex-1"><h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('users.administratorAccess')}</h4><p className="text-xs text-slate-500 mt-1">{AdminI18n.t('users.fullSystemAccess2faStrongly')}</p></div></div> : null}
        </div>
      </Card>
    );
  }
}

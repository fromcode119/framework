import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { UserSecurityPageService } from '@/app/users/[id]/security/user-security-page-service';
import type { IAuthActivityEntry } from '@/app/users/[id]/security/interfaces/auth-activity-entry.interface';
import { AdminClass } from '@/lib/admin-class';

export class AuthActivityCard extends PureReactor {
  @prop declare activity: IAuthActivityEntry[];
  @prop declare activityLoading: boolean;
  @prop declare email: string;
  @prop declare isDark: boolean;

  render(): ReactNode {
    const { activity, activityLoading, email, isDark } = this;
    return (
      <div id="auth-activity">
        <Card title="Login & Session Activity" icon={<FrameworkIcons.Activity size={18} className="text-indigo-500" />}>
          <div className="space-y-3">
            {activityLoading ? <div className="py-4"><Loader label="Loading auth activity..." /></div> : activity.length === 0 ? <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-4">No recent login/session events for this user.</div> : activity.slice(0, 12).map((entry, index) => { const timestamp = entry.timestamp || entry.createdAt; const level = String(entry.level || '').toUpperCase(); return <div key={entry.id || `${index}-${timestamp || ''}`} className={`p-3 ${AdminClass.SURFACE} ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><span className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-tight ${UserSecurityPageService.buildActivityLevelClass(level)}`}>{level || 'INFO'}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{timestamp ? new Date(timestamp).toLocaleString() : 'Unknown Time'}</span></div><p className="text-xs font-semibold text-slate-600 dark:text-slate-200 mt-2">{entry.message || 'Activity event'}</p></div>; })}
            <div className="pt-2"><Link href={AdminConstants.ROUTES.ACTIVITY_FILTER({ mode: 'system', user: email })}><Button variant={ButtonVariant.GHOST} className="font-bold text-xs tracking-tight uppercase">Open Full Global Activity</Button></Link></div>
          </div>
        </Card>
      </div>
    );
  }
}

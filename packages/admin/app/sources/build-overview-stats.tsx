import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop } from '@fromcode119/react-class-components';

import { Card } from '@/components/ui/view/card.client';
import { CheckCircle, Clock, Hammer, XCircle } from 'lucide-react';

export class BuildOverviewStats extends AdminComponent {
  declare props: { builds: any[]; loading: boolean };
  @prop declare builds: any[];
  @prop declare loading: boolean;

  render(): ReactNode {
    const { builds, loading } = this;
    const successCount = builds.filter((build) => build.lastBuildStatus === 'success').length;
    const failedCount = builds.filter((build) => build.lastBuildStatus === 'failed').length;
    const pendingCount = builds.filter((build) => build.lastBuildStatus === 'pending' || build.lastBuildStatus === 'building').length;
    const indicators = [
      { bg: 'bg-indigo-500/10', color: 'text-indigo-500', icon: Hammer, label: 'Total Packages', note: 'Plugins and themes tracked from their repositories.', value: String(builds.length) },
      { bg: 'bg-emerald-500/10', color: 'text-emerald-500', icon: CheckCircle, label: 'Successful', note: 'Packages with a completed build and published archive.', value: String(successCount) },
      { bg: 'bg-rose-500/10', color: 'text-rose-500', icon: XCircle, label: 'Failed', note: 'Packages whose last build encountered an error.', value: String(failedCount) },
      { bg: 'bg-amber-500/10', color: 'text-amber-500', icon: Clock, label: 'Pending', note: 'Packages awaiting their first build or currently building.', value: String(pendingCount) },
    ];

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {indicators.map((indicator) => {
          const Icon = indicator.icon;
          return (
            <Card key={indicator.label} className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{indicator.label}</p>
                  <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{loading ? '…' : indicator.value}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">{indicator.note}</p>
                </div>
                <div className={`${indicator.bg} ${indicator.color} flex h-12 w-12 items-center justify-center rounded-2xl`}>
                  <Icon size={24} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }
}

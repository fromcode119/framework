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
      /*
       * ONE strip, not four panels.
       *
       * Four counters whose values are almost always 0 or 1 were given a full-width card each, so
       * each tile was ~340px of mostly nothing with its icon floating at the far edge, disconnected
       * from the number it belongs to. Making the tiles shorter did not fix that — the emptiness was
       * horizontal. A single row puts the four numbers side by side where they can be compared,
       * which is the only reason to show them together at all.
       */
      <Card>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {indicators.map((indicator) => {
            const Icon = indicator.icon;
            return (
              <div key={indicator.label} className="flex items-center gap-2.5" title={indicator.note}>
                <span className={`${indicator.bg} ${indicator.color} flex h-7 w-7 shrink-0 items-center justify-center rounded-full`}>
                  <Icon size={14} />
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-lg font-bold leading-none tracking-tight text-slate-900 dark:text-white">
                    {loading ? '…' : indicator.value}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {indicator.label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }
}

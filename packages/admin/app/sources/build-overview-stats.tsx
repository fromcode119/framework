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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {indicators.map((indicator) => {
          const Icon = indicator.icon;
          return (
            /*
             * Padding only. The radius, the edge and the fill belong to `.fc-surface`, which is the
             * one definition of a card here and the one an appearance can repaint — this card used to
             * spell `rounded-3xl border-slate-200 bg-white` over the top, which is exactly the
             * hardcoded-#fff case admin.css warns about, and made these four the only cards on the
             * screen with their own shape.
             */
            <Card key={indicator.label}>
              {/* The note stays reachable as a tooltip: it explains the counter, but spelled out on
                  the card it was a full sentence per tile and three times the height. */}
              <div className="flex items-center justify-between gap-3" title={indicator.note}>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{indicator.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{loading ? '…' : indicator.value}</p>
                </div>
                {/* A circle, not a 16px-radius square pretending to be one. */}
                <div className={`${indicator.bg} ${indicator.color} flex h-9 w-9 shrink-0 items-center justify-center rounded-full`}>
                  <Icon size={16} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }
}

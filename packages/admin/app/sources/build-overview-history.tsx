import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop } from '@fromcode119/react-class-components';

import { Card } from '@/components/ui/view/card.client';
import { Hammer } from 'lucide-react';
import { BuildSourceListItem } from '@/app/sources/build-source-list-item';

export class BuildOverviewHistory extends AdminComponent {
  declare props: {
    builds: any[]; deletingSlug: string | null; loading: boolean;
    onDelete: (slug: string) => void; onEdit: (build: any) => void;
    onTrigger: (slug: string) => void; triggerSlug: string | null;
  };
  @prop declare builds: any[];
  @prop declare deletingSlug: string | null;
  @prop declare loading: boolean;
  @prop declare onDelete: (slug: string) => void;
  @prop declare onEdit: (build: any) => void;
  @prop declare onTrigger: (slug: string) => void;
  @prop declare triggerSlug: string | null;

  render(): ReactNode {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">Build History</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Each row shows the tracked branch, the last published version, and the generated package filename.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {this.loading ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Loading build status…
          </div>
        ) : null}

        {!this.loading && this.builds.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
              <Hammer size={18} />
            </div>
            <h4 className="mt-3 text-sm font-semibold tracking-tight text-slate-900 dark:text-white">No Builds Yet</h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use “Add Source” to track a plugin, theme, or core repository, then build it from this page.</p>
          </div>
        ) : null}

        {this.builds.map((build) => (
          <BuildSourceListItem
            key={build.slug}
            build={build}
            deletingSlug={this.deletingSlug}
            onDelete={this.onDelete}
            onEdit={this.onEdit}
            onTrigger={this.onTrigger}
            triggerSlug={this.triggerSlug}
          />
        ))}
      </div>
    </Card>
  );
}
}

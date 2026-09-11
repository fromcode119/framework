import type { ReactNode } from 'react';
import { PluginComponent, prop } from '@fromcode119/sdk/react';

import { Card } from '@fromcode119/sdk/admin';
import { Hammer } from 'lucide-react';
import { BuildSourceListItem } from '@plugin/src/ui/build-source-list-item';

export class BuildOverviewHistory extends PluginComponent {
  declare props: {
    builds: any[]; deletingSlug: string | null; loading: boolean;
    onDelete: (slug: string) => void; onEdit: (build: any) => void;
    onTrigger: (slug: string) => void; triggerSlug: string | null;
  };
  @prop builds!: any[];
  @prop deletingSlug!: string | null;
  @prop loading!: boolean;
  @prop onDelete!: (slug: string) => void;
  @prop onEdit!: (build: any) => void;
  @prop onTrigger!: (slug: string) => void;
  @prop triggerSlug!: string | null;

  render(): ReactNode {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Build History</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Each row shows the tracked branch, the last published version, and the generated package filename.</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {this.loading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Loading build status…
          </div>
        ) : null}

        {!this.loading && this.builds.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
              <Hammer size={26} />
            </div>
          <h4 className="mt-5 text-lg font-black tracking-tight text-slate-900 dark:text-white">No Builds Yet</h4>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use “Add Source” to track a plugin, theme, or core repository, then build it from this page.</p>
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

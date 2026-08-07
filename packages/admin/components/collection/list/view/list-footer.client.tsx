import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/** Collection list footer (record count + export/import/API links). Pure presentational class. */
export class ListFooter extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare slug: string;
  @prop declare total: number;
  @prop declare resolvedSlug: string;
  @prop declare handleExport: (format: ExportFormat) => void;
  @prop declare handleImport: (e: ChangeEvent<HTMLInputElement>) => void;

  render(): ReactNode {
    return (
      <div className={`mt-auto border-t py-12 backdrop-blur-3xl transition-all duration-300 ${
        this.theme === ThemeMode.DARK
          ? 'bg-slate-950/40 border-slate-800'
          : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            {/* Was "Data Management Node // SLUG" over a pulsing dot, and "Connected to N records in
                the system cluster." Both implied a distributed cluster topology that does not exist —
                the same fabrication as the dashboard-footer "distributed cluster node" line. The
                record count is real, so it stays; the invented infrastructure around it does not. */}
            <p className="text-xs font-semibold text-slate-400 tracking-wide text-center md:text-left">
              {this.total} {this.total === 1 ? 'record' : 'records'}
            </p>

            <div className="flex items-center gap-10 text-xs font-semibold tracking-wide text-slate-400">
              <button
                onClick={() => this.handleExport(ExportFormat.JSON)}
                className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300"
              >
                Export JSON
              </button>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <label className="cursor-pointer hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300">
                Bulk Import
                <input type="file" className="hidden" accept=".json" onChange={this.handleImport} />
              </label>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <a
                href={`${AdminApi.getBaseUrl()}${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${this.resolvedSlug}`}
                target="_blank"
                className="hover:text-indigo-500 transition-colors hover:translate-x-1 duration-300"
              >
                API Endpoint
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

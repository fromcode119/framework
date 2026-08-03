import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { AdminClass } from '@/lib/admin-class';

export class BackupOperatorNotesCard extends AdminComponent {
  render(): ReactNode {
    const theme = this.theme;

    return (
    <Card>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <h2 className={`text-lg font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>Operator Notes</h2>
          <p className="text-sm text-slate-500">
            Create a system snapshot before updates, use preview before every restore, and keep site-transfer bundles on the CLI path.
          </p>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">CLI Bundle Command</div>
            <pre className={`mt-3 overflow-x-auto ${AdminClass.SURFACE} px-4 py-3 text-xs ${theme === ThemeMode.DARK ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-700'}`}>npm run fromcode -- system site-transfer-bundle --label demo-transfer</pre>
          </div>
          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Wrapper Script</div>
            <pre className={`mt-3 overflow-x-auto ${AdminClass.SURFACE} px-4 py-3 text-xs ${theme === ThemeMode.DARK ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-700'}`}>npm run bundle:site-transfer -- --label demo-transfer</pre>
          </div>
          <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Reference Documentation</div>
            <p className="mt-3 text-sm text-slate-500">framework/Source/docs/backup-and-transfer.md</p>
            <p className="mt-2 text-xs text-slate-500">Restore execution always creates a rollback snapshot first and rejects arbitrary filesystem targets from the browser.</p>
          </div>
        </div>
      </div>
    </Card>
    );
  }
}
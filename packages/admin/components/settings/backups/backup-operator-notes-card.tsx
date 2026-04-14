'use client';

import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';

export function BackupOperatorNotesCard() {
  const { theme } = ThemeHooks.useTheme();

  return (
    <Card className="border-0 rounded-[2rem] p-8 shadow-[0_20px_64px_-28px_rgba(15,23,42,0.2)] dark:ring-1 dark:ring-white/5">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <h2 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Operator Notes</h2>
          <p className="text-sm text-slate-500">
            Create a system snapshot before updates, use preview before every restore, and keep site-transfer bundles on the CLI path.
          </p>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className={`rounded-[1.5rem] border p-5 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">CLI Bundle Command</div>
            <pre className={`mt-3 overflow-x-auto rounded-2xl px-4 py-3 text-xs ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-700'}`}>npm run fromcode -- system site-transfer-bundle --label demo-transfer</pre>
          </div>
          <div className={`rounded-[1.5rem] border p-5 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Wrapper Script</div>
            <pre className={`mt-3 overflow-x-auto rounded-2xl px-4 py-3 text-xs ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-700'}`}>npm run bundle:site-transfer -- --label demo-transfer</pre>
          </div>
          <div className={`rounded-[1.5rem] border p-5 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Reference Documentation</div>
            <p className="mt-3 text-sm text-slate-500">framework/Source/docs/backup-and-transfer.md</p>
            <p className="mt-2 text-xs text-slate-500">Restore execution always creates a rollback snapshot first and rejects arbitrary filesystem targets from the browser.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
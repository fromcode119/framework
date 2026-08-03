import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { RestoreTargetScope } from '@/components/settings/backups/enums/restore-target-scope.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { RootFramework } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { TextArea } from '@/components/ui/view/text-area.client';
import { FrameworkIcons } from '@fromcode119/react';
import { prop } from '@fromcode119/reactor';
import type { IRestoreDialogState } from '@/components/settings/backups/interfaces/restore-dialog-state.interface';
import { AdminClass } from '@/lib/admin-class';

export class BackupRestoreDialog extends AdminComponent {
  @prop declare isOpen: boolean;
  @prop declare isPreviewing: boolean;
  @prop declare isRestoring: boolean;
  @prop declare onClose: () => void;
  @prop declare onTargetScopeChange: (value: RestoreTargetScope) => void;
  @prop declare onTargetSlugChange: (value: string) => void;
  @prop declare onConfirmationTextChange: (value: string) => void;
  @prop declare onPreview: () => Promise<void>;
  @prop declare onExecute: () => Promise<void>;

  /** The `state` prop — read via a getter because `this.state` is owned by React. */
  private get restoreState(): IRestoreDialogState {
    return this.props.state as IRestoreDialogState;
  }

  render(): ReactNode {
    const {
      isOpen,
      isPreviewing,
      isRestoring,
      onClose,
      onTargetScopeChange,
      onTargetSlugChange,
      onConfirmationTextChange,
      onPreview,
      onExecute,
    } = this;
    const state = this.restoreState;
    const theme = this.theme;

    if (!isOpen || !state.backup) {
      return null;
    }

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6">
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />

        <div className={`relative z-[1] max-h-[90vh] w-full max-w-3xl overflow-y-auto ${AdminClass.SURFACE} p-5 ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${theme === ThemeMode.DARK ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                  <FrameworkIcons.Warning size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Preview Restore</h3>
                  <p className="text-sm text-slate-500">Validate target scope, review warnings, then type the server-issued confirmation challenge.</p>
                </div>
              </div>
              <Badge variant={BadgeVariant.WARNING}>Restore never runs directly from the table action.</Badge>
            </div>

            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white">
              <FrameworkIcons.Close size={18} />
            </button>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/70' : 'border-slate-100 bg-slate-50/80'}`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Selected Backup</div>
                <div className="mt-3 text-base font-bold tracking-tight">{state.backup.displayName}</div>
                <div className="mt-1 text-sm text-slate-500">{state.backup.filename}</div>
              </div>

              <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/70' : 'border-slate-100 bg-slate-50/80'}`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Restore Target</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(RestoreTargetScope.values() as RestoreTargetScope[]).map((scope) => (
                    <button
                      key={scope.value}
                      type="button"
                      onClick={() => onTargetScopeChange(scope)}
                      className={`${AdminClass.SURFACE} px-4 py-3 text-sm font-bold tracking-tight transition-all ${state.targetScope === scope ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                    >
                      {scope === RestoreTargetScope.SYSTEM ? 'System Root' : scope === RestoreTargetScope.PLUGIN ? 'Plugin Slug' : 'Theme Slug'}
                    </button>
                  ))}
                </div>
                {state.targetScope !== RestoreTargetScope.SYSTEM ? (
                  <div className="mt-4">
                    <Input
                      label={state.targetScope === RestoreTargetScope.PLUGIN ? 'Plugin slug' : 'Theme slug'}
                      value={state.targetSlug}
                      onChange={(event) => onTargetSlugChange(event.target.value)}
                      placeholder={state.targetScope === RestoreTargetScope.PLUGIN ? 'example-plugin' : 'example-theme'}
                    />
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-slate-500">The browser sends only approved target kinds: system, plugin:&lt;slug&gt;, or theme:&lt;slug&gt;.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/70' : 'border-slate-100 bg-slate-50/80'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Server Preview</div>
                    <p className="mt-2 text-sm text-slate-500">Preview revalidates the backup id and target before any extraction happens.</p>
                  </div>
                  <Button size={FieldSize.SM} className="rounded-lg uppercase tracking-[0.16em]" isLoading={isPreviewing} onClick={() => void onPreview()}>
                    Run Preview
                  </Button>
                </div>

                {state.preview ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                      Target validated as <strong>{state.preview.targetLabel}</strong>. Safety snapshot type: <strong>{state.preview.snapshotType.value}</strong>.
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Confirmation Challenge</div>
                      <div className={`mt-2 ${AdminClass.SURFACE} px-4 py-3 font-mono text-xs ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}>
                        {state.preview.requiredConfirmationText}
                      </div>
                    </div>
                    <TextArea
                      label="Type the confirmation text exactly"
                      value={state.confirmationText}
                      onChange={(event) => onConfirmationTextChange(event.target.value)}
                      placeholder="Paste the confirmation challenge here"
                    />
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-800">
                    Preview the restore first to receive warnings and the confirmation challenge.
                  </div>
                )}
              </div>

              <div className={`rounded-lg border p-5 ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900/70' : 'border-slate-100 bg-slate-50/80'}`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Warnings</div>
                {state.preview?.warnings?.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-slate-500">
                    {state.preview.warnings.map((warning) => (
                      <li key={warning} className="flex gap-2">
                        <FrameworkIcons.Warning size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Warnings will appear here after preview.</p>
                )}
                {state.formError ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                    {state.formError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant={ButtonVariant.GHOST} className="rounded-xl uppercase tracking-[0.16em]" onClick={onClose} disabled={isPreviewing || isRestoring}>
              Close
            </Button>
            <Button
              variant={ButtonVariant.DANGER}
              className="rounded-xl uppercase tracking-[0.16em]"
              isLoading={isRestoring}
              onClick={() => void onExecute()}
              disabled={!state.preview}
            >
              Execute Restore
            </Button>
          </div>
        </div>
      </div>
    </RootFramework>
    );
  }
}
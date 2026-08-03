import { DependencyIssueType } from '@/components/ui/enums/dependency-issue-type.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@/components/ui/view/root-framework.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { IDependencyIssue } from '@/components/ui/interfaces/dependency-issue.interface';
import { AdminClass } from '@/lib/admin-class';
export class DependencyDialog extends AdminComponent {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: (recursive: boolean, force: boolean) => void;
  @prop declare issues: IDependencyIssue[];
  @prop declare pluginSlug: string;
  @prop declare isLoading?: boolean;

  private applyBodyOverflow(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = this.isOpen ? 'hidden' : 'unset';
  }

  componentDidMount(): void {
    this.applyBodyOverflow();
  }

  componentDidUpdate(prevProps: { isOpen: boolean }): void {
    if (prevProps.isOpen !== this.isOpen) this.applyBodyOverflow();
  }

  componentWillUnmount(): void {
    if (typeof document !== 'undefined') document.body.style.overflow = 'unset';
  }

  @bound private confirmResolve(): void {
    this.onConfirm(true, false);
  }

  @bound private confirmForce(): void {
    this.onConfirm(false, true);
  }

  render(): ReactNode {
    const isLoading = this.isLoading ?? false;
    const theme = this.theme;

    if (!this.isOpen) return null;

    const issues = this.issues;
    const pluginSlug = this.pluginSlug;
    const onClose = this.onClose;

    const hasMissing = issues.some(i => String(i.type) === DependencyIssueType.MISSING.value);
    const hasIncompatible = issues.some(i => String(i.type) === DependencyIssueType.INCOMPATIBLE.value);
    const onlyInactive = issues.every(i => String(i.type) === DependencyIssueType.INACTIVE.value);

    const primaryLabel = hasMissing
      ? "Install & Enable All"
      : onlyInactive
        ? "Enable Dependencies"
        : "Resolve & Activate";

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={onClose}
        />

        <div className={`relative w-full max-w-lg my-auto ${AdminClass.SURFACE} p-5 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300`}>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${hasMissing ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500'}`}>
              <FrameworkIcons.Warning size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {hasMissing ? 'Missing Requirements Found' : 'Inactive Dependencies Detected'}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                To enable <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">{pluginSlug}</span>, we need to handle the following:
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg transition-colors hover:bg-slate-50 text-slate-400 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-500 dark:hover:text-white"
            >
              <FrameworkIcons.Close size={20} />
            </button>
          </div>

          <div className="mt-4 space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {issues.map((issue, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border shadow-sm ${
                  String(issue.type) === DependencyIssueType.MISSING.value ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-900/30' :
                  'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}>
                  <FrameworkIcons.Box size={20} className={String(issue.type) === DependencyIssueType.MISSING.value ? 'text-rose-500' : 'text-indigo-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">{issue.slug}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-lg font-bold uppercase tracking-tight ${
                      String(issue.type) === DependencyIssueType.MISSING.value ? 'bg-rose-500 text-white' :
                      String(issue.type) === DependencyIssueType.INACTIVE.value ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-500'
                    }`}>
                      {String(issue.type) === DependencyIssueType.MISSING.value ? 'NOT INSTALLED' : issue.type.value.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {String(issue.type) === DependencyIssueType.MISSING.value && `Requires version ${issue.expected}. We can download this from the marketplace.`}
                    {String(issue.type) === DependencyIssueType.INACTIVE.value && `Already installed but needs to be activated (Version ${issue.expected}).`}
                    {String(issue.type) === DependencyIssueType.INCOMPATIBLE.value && `Version mismatch: requires ${issue.expected}, found ${issue.actual}.`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {!hasIncompatible && (
              <Button
                variant={ButtonVariant.PRIMARY}
                className={`w-full py-6 rounded-xl font-bold uppercase tracking-widest text-[11px] shadow-lg ${
                  hasMissing ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'shadow-indigo-500/20'
                }`}
                onClick={this.confirmResolve}
                isLoading={isLoading}
              >
                {primaryLabel}
              </Button>
            )}

            <div className={`p-4 rounded-xl text-[10px] font-medium leading-tight ${theme === ThemeMode.DARK ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              Activating without dependencies may cause the system to behave unexpectedly or crash if the plugin relies on them for core data.
            </div>

            <Button
              variant={ButtonVariant.GHOST}
              className="w-full py-6 rounded-xl font-bold uppercase tracking-widest text-[11px] border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={this.confirmForce}
              disabled={isLoading}
            >
              Force Activate Anyway
            </Button>

            <Button
              variant={ButtonVariant.GHOST}
              className="w-full"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </RootFramework>
    );
  }
}

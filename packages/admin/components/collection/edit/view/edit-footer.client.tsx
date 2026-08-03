import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';

export class EditFooter extends PureReactor {
  @prop declare collection: any;
  @prop declare theme: ThemeMode;
  @prop declare isNew: boolean;
  @prop declare discardHref?: string;
  @prop declare handleSubmit: (e: any, summary: string) => void;
  @prop declare changeSummary: string;
  @prop declare setChangeSummary: (val: string) => void;
  @prop declare saving: boolean;
  @prop declare router: any;

  @bound
  private onDiscard(): void {
    if (this.discardHref) {
      this.router.push(this.discardHref);
      return;
    }
    this.router.back();
  }

  @bound
  private onCommit(e: any): void {
    this.handleSubmit(e, this.changeSummary);
    this.setChangeSummary('');
  }

  render(): ReactNode {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-[100] border-t py-10 backdrop-blur-3xl transition-all duration-300 ${
        this.theme === ThemeMode.DARK
          ? 'bg-slate-950/80 border-slate-800/50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]'
          : 'bg-white/80 border-slate-100 shadow-lg'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8 pl-20 lg:pl-64">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Persistence Layer // {this.collection.unprefixedSlug || this.collection.shortSlug || this.collection.slug}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Button
              variant={ButtonVariant.GHOST}
              className="rounded-xl px-6 text-[10px] font-bold uppercase tracking-wide text-slate-400"
              onClick={this.onDiscard}
            >
              Discard Changes
            </Button>
            <Button
              className="rounded-xl px-12 shadow-2xl shadow-indigo-600/30 text-[10px] font-bold uppercase tracking-wide py-4.5"
              onClick={this.onCommit}
              isLoading={this.saving}
              icon={<FrameworkIcons.Save size={16} strokeWidth={3} />}
            >
              {this.isNew ? 'Create Entry' : 'Commit Changes'}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

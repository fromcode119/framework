import type { ReactNode } from 'react';
import { PluginComponent, prop } from '@fromcode119/sdk/react';
import type { ElementType } from 'react';
import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';

export class BuildStatusBadge extends PluginComponent {
  declare props: { status: string };
  @prop status!: string;

  render(): ReactNode {
    const config: Record<string, { bg: string; icon: ElementType; label: string; text: string }> = {
      building: {
        bg: 'bg-amber-100 dark:bg-amber-950/60',
        icon: Loader2,
        label: 'Building',
        text: 'text-amber-700 dark:text-amber-300',
      },
      failed: {
        bg: 'bg-rose-100 dark:bg-rose-950/60',
        icon: XCircle,
        label: 'Failed',
        text: 'text-rose-700 dark:text-rose-300',
      },
      pending: {
        bg: 'bg-slate-100 dark:bg-slate-800',
        icon: Clock,
        label: 'Pending',
        text: 'text-slate-600 dark:text-slate-400',
      },
      success: {
        bg: 'bg-emerald-100 dark:bg-emerald-950/60',
        icon: CheckCircle,
        label: 'Success',
        text: 'text-emerald-700 dark:text-emerald-300',
      },
    };
    const state = config[this.status] || config.pending;
    const Icon = state.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${state.bg} ${state.text}`}>
        <Icon size={12} className={this.status === 'building' ? 'animate-spin' : ''} />
        {state.label}
      </span>
    );
  }
}

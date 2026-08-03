import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import type { ConversationMode } from '@ai/enums/conversation-mode.enum';
import type { PhaseStep } from '@ai/components/phase-step';
import { AssistantMode } from '@ai/components/enums/assistant-mode.enum';

/**
 * Animated multi-phase loading indicator for an in-flight assistant turn. Presentational → `PureReactor`;
 * the phase sequence comes from the `AssistantMode` enum, and the active phase + step index are getters.
 */
export class AssistantLoadingState extends PureReactor {
  @prop declare mode: ConversationMode;
  @prop declare phase: number;
  @prop declare totalPhases?: number;

  private get phases(): readonly PhaseStep[] {
    return AssistantMode.resolve(this.mode.value).loadingPhases;
  }

  private get stepIndex(): number {
    return this.phase % this.phases.length;
  }

  private get currentPhase(): PhaseStep {
    return this.phases[this.stepIndex];
  }

  render(): ReactNode {
    const Icon = this.currentPhase.icon;
    return (
      <div className="flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex max-w-[92%] gap-3 items-start">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center mt-1">
            <div className="absolute inset-0 rounded-lg bg-[var(--surface-strong)] animate-pulse shadow-[0_0_14px_rgba(15,23,42,0.24)]" style={{ animationDuration: '2s' }} />
            <div className="relative flex items-center justify-center rounded-lg bg-[var(--surface)] shadow-[0_0_10px_rgba(15,23,42,0.2)]">
              <Icon size={14} className="text-[var(--text-sub)]" />
            </div>
          </div>

          <div className="flex-1 rounded-xl border border-white/62 bg-white/72 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/12 dark:bg-slate-900/52 dark:shadow-[0_12px_28px_rgba(2,6,23,0.48)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{this.currentPhase.label}</p>
                <div className="mt-2 flex gap-1">
                  {this.phases.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-0.5 w-1.5 rounded-full transition-all duration-300 ${
                        idx <= this.stepIndex
                          ? 'bg-[var(--text-main)] shadow-[0_0_8px_rgba(15,23,42,0.32)]'
                          : 'bg-slate-300/30 dark:bg-slate-700/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

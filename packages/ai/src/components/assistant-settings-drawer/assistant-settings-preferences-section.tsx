import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { GlassMorphism } from '@ai/ui/glass-morphism';

export class AssistantSettingsPreferencesSection extends PureReactor {
  @prop declare autoApprove: boolean;
  @prop declare onAutoApproveChange: (value: boolean) => void;
  @prop declare showTechnicalDetails: boolean;
  @prop declare onShowTechnicalDetailsChange: (value: boolean) => void;
  @prop declare verboseLogging: boolean;
  @prop declare onVerboseLoggingChange: (value: boolean) => void;

  @bound
  protected toggleTechnicalDetails(): void {
    this.onShowTechnicalDetailsChange(!this.showTechnicalDetails);
  }

  @bound
  protected onAutoApproveInput(event: ChangeEvent<HTMLInputElement>): void {
    this.onAutoApproveChange(event.target.checked);
  }

  @bound
  protected onVerboseLoggingInput(event: ChangeEvent<HTMLInputElement>): void {
    this.onVerboseLoggingChange(event.target.checked);
  }

  render(): ReactNode {
    return (
      <section className={`${GlassMorphism.GLASS_SUB_PANEL} p-4`}>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[var(--text-main)]">Developer Mode</span>
              <span className="text-[10px] text-[var(--text-sub)]">Show traces and tool payloads</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={this.showTechnicalDetails}
              onClick={this.toggleTechnicalDetails}
              className={`relative h-5 w-9 rounded-full border transition ${
                this.showTechnicalDetails
                  ? 'border-[var(--text-main)] bg-[var(--text-main)]'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
            >
              <span
                className={`absolute top-[2px] h-3.5 w-3.5 rounded-full transition ${
                  this.showTechnicalDetails ? 'left-[18px] bg-[var(--bg)]' : 'left-[2px] bg-[var(--text-main)]'
                }`}
              />
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-sub)]">
              Capabilities
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={this.autoApprove}
                onChange={this.onAutoApproveInput}
                className="sr-only"
              />
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-black ${
                  this.autoApprove
                    ? 'border-[var(--text-main)] bg-[var(--text-main)] text-[var(--bg)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-transparent'
                }`}
              >
                ✓
              </span>
              <span className="text-sm text-[var(--text-main)]">Auto Approve Safe Changes</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={this.verboseLogging}
                onChange={this.onVerboseLoggingInput}
                className="sr-only"
              />
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-black ${
                  this.verboseLogging
                    ? 'border-[var(--text-main)] bg-[var(--text-main)] text-[var(--bg)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-transparent'
                }`}
              >
                ✓
              </span>
              <span className="text-sm text-[var(--text-main)]">Verbose Logging</span>
            </label>
          </div>
        </div>
      </section>
    );
  }
}

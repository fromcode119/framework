import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Select } from '@ai/ui/select';
import type { SelectOption } from '@ai/ui/select-option';
import { GlassMorphism } from '@ai/ui/glass-morphism';

export class AssistantSettingsProviderSection extends PureReactor {
  private static readonly MATTE_SELECT_CLASS =
  "w-full [&_button]:!h-11 [&_button]:!rounded-xl [&_button]:!border-[var(--border)] [&_button]:!bg-[var(--surface)] [&_button]:!text-[var(--text-main)] [&_button]:hover:!bg-[var(--surface-strong)]";

  @prop declare provider: string;
  @prop declare onProviderChange: (provider: string) => void;
  @prop declare providerOptions: SelectOption[];
  @prop declare model: string;
  @prop declare onModelChange: (model: string) => void;
  @prop declare modelOptions: SelectOption[];
  @prop declare loadingModels: boolean;
  @prop declare modelsError: string;
  @prop declare skillId: string;
  @prop declare onSkillIdChange: (skillId: string) => void;
  @prop declare skillOptions: SelectOption[];

  render(): ReactNode {
    return (
      <section className={`${GlassMorphism.GLASS_SUB_PANEL} p-4`}>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-sub)]">
          Inference Engine
        </p>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-sub)]">
              Provider
            </label>
            <Select
              value={this.provider}
              onChange={this.onProviderChange}
              options={this.providerOptions}
              className={AssistantSettingsProviderSection.MATTE_SELECT_CLASS}
              searchable={false}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-sub)]">
              Model
            </label>
            <Select
              value={this.model}
              onChange={this.onModelChange}
              options={this.modelOptions}
              disabled={this.loadingModels}
              className={AssistantSettingsProviderSection.MATTE_SELECT_CLASS}
              searchable={false}
            />
            {this.loadingModels ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-main)]" />
                <span className="text-xs font-medium text-[var(--text-sub)]">Loading models</span>
              </div>
            ) : null}
            {this.modelsError ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{this.modelsError}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-sub)]">
              Role / Skill
            </label>
            <Select
              value={this.skillId}
              onChange={this.onSkillIdChange}
              options={this.skillOptions}
              className={AssistantSettingsProviderSection.MATTE_SELECT_CLASS}
              searchable={false}
            />
            <p className="mt-1.5 text-xs text-[var(--text-sub)]">Select the AI role for specialized responses</p>
          </div>
        </div>
      </section>
    );
  }
}

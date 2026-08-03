import { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';
import { AssistantCopyUtils } from '@ai/assistant-copy';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import type { IAssistantChatInput } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-input.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';

export class AdminAssistantRuntimeSkillService {
  constructor(private readonly options: IAdminAssistantRuntimeOptions) {}

  toRunMode(input: string): AssistantRunMode {
    const value = String(input || '').trim().toLowerCase();
    if (value === AssistantRunMode.PLAN.value) return AssistantRunMode.PLAN;
    if (value === AssistantRunMode.AGENT.value) return AssistantRunMode.AGENT;
    return AssistantRunMode.CHAT;
  }

  async listSkills(): Promise<IAssistantSkillDefinition[]> {
    const defaults = this.defaultSkillCatalog();
    const extra = await Promise.resolve(this.options.resolveSkills?.() || []);
    return this.normalizeSkills([...(Array.isArray(extra) ? extra : []), ...defaults]);
  }

  resolveSkillForInput(
    input: IAssistantChatInput,
    skills: IAssistantSkillDefinition[],
  ): IAssistantSkillDefinition | undefined {
    const selectedSkillId = String(input?.skillId || 'general').trim().toLowerCase() || 'general';
    return (
      skills.find((skill) => skill.id === selectedSkillId) ||
      skills.find((skill) => skill.id === 'general') ||
      skills[0]
    );
  }

  resolveAgentMode(
    input: IAssistantChatInput,
    selectedSkill?: IAssistantSkillDefinition,
  ): ContextLevel {
    const requestedMode = String(input?.agentMode || '').trim().toLowerCase();
    if (requestedMode === ContextLevel.ADVANCED.value || requestedMode === 'plan' || requestedMode === 'agent') return ContextLevel.ADVANCED;
    if (requestedMode === ContextLevel.BASIC.value || requestedMode === 'chat' || requestedMode === 'auto') return ContextLevel.BASIC;
    return String(selectedSkill?.defaultMode ?? 'chat') === 'chat' ? ContextLevel.BASIC : ContextLevel.ADVANCED;
  }

  private defaultSkillCatalog(): IAssistantSkillDefinition[] {
    return AssistantCopyUtils.DEFAULT_SKILLS.map((skill) => ({
      ...skill,
      allowedTools: Array.isArray((skill as any).allowedTools) ? [...(skill as any).allowedTools] : undefined,
      entryExamples: Array.isArray((skill as any).entryExamples) ? [...(skill as any).entryExamples] : undefined,
    }));
  }

  private normalizeSkills(skills: IAssistantSkillDefinition[]): IAssistantSkillDefinition[] {
    const seen = new Set<string>();
    const output: IAssistantSkillDefinition[] = [];
    for (const item of Array.isArray(skills) ? skills : []) {
      if (!item || typeof item !== 'object') continue;
      const id = String(item.id || '').trim().toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      output.push({
        id,
        label: String(item.label || id),
        description: item.description ? String(item.description) : undefined,
        defaultMode: this.toRunMode(String(item.defaultMode || 'chat')),
        allowedTools: Array.isArray(item.allowedTools)
          ? item.allowedTools.map((tool) => String(tool || '').trim()).filter(Boolean)
          : undefined,
        systemPromptPatch: item.systemPromptPatch ? String(item.systemPromptPatch) : undefined,
        riskPolicy: AssistantSkillRiskPolicy.resolve(String(item.riskPolicy ?? '').trim().toLowerCase() || AssistantSkillRiskPolicy.APPROVAL_REQUIRED.value),
        entryExamples: Array.isArray(item.entryExamples)
          ? item.entryExamples.map((entry) => String(entry || '').trim()).filter(Boolean)
          : undefined,
      });
    }
    if (!output.some((skill) => skill.id === 'general')) {
      output.unshift(this.defaultSkillCatalog()[0]);
    }
    return output;
  }
}

import { AssistantCopyUtils } from '../assistant-copy';
import type {
  AdminAssistantRuntimeOptions,
  AssistantChatInput,
  AssistantSkillDefinition,
  AssistantSkillRiskPolicy,
} from '../admin-assistant-runtime/types';

export class AdminAssistantRuntimeSkillService {
  constructor(private readonly options: AdminAssistantRuntimeOptions) {}

  toRunMode(input: string): 'chat' | 'plan' | 'agent' {
    const value = String(input || '').trim().toLowerCase();
    if (value === 'plan') return 'plan';
    if (value === 'agent') return 'agent';
    return 'chat';
  }

  async listSkills(): Promise<AssistantSkillDefinition[]> {
    const defaults = this.defaultSkillCatalog();
    const extra = await Promise.resolve(this.options.resolveSkills?.() || []);
    return this.normalizeSkills([...(Array.isArray(extra) ? extra : []), ...defaults]);
  }

  resolveSkillForInput(
    input: AssistantChatInput,
    skills: AssistantSkillDefinition[],
  ): AssistantSkillDefinition | undefined {
    const selectedSkillId = String(input?.skillId || 'general').trim().toLowerCase() || 'general';
    return (
      skills.find((skill) => skill.id === selectedSkillId) ||
      skills.find((skill) => skill.id === 'general') ||
      skills[0]
    );
  }

  resolveAgentMode(
    input: AssistantChatInput,
    selectedSkill?: AssistantSkillDefinition,
  ): 'basic' | 'advanced' {
    const requestedMode = String(input?.agentMode || '').trim().toLowerCase();
    if (requestedMode === 'advanced' || requestedMode === 'plan' || requestedMode === 'agent') return 'advanced';
    if (requestedMode === 'basic' || requestedMode === 'chat' || requestedMode === 'auto') return 'basic';
    return (selectedSkill?.defaultMode || 'chat') === 'chat' ? 'basic' : 'advanced';
  }

  private defaultSkillCatalog(): AssistantSkillDefinition[] {
    return AssistantCopyUtils.DEFAULT_SKILLS.map((skill) => ({
      ...skill,
      allowedTools: Array.isArray((skill as any).allowedTools) ? [...(skill as any).allowedTools] : undefined,
      entryExamples: Array.isArray((skill as any).entryExamples) ? [...(skill as any).entryExamples] : undefined,
    })) as AssistantSkillDefinition[];
  }

  private normalizeSkills(skills: AssistantSkillDefinition[]): AssistantSkillDefinition[] {
    const seen = new Set<string>();
    const output: AssistantSkillDefinition[] = [];
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
        riskPolicy:
          (String(item.riskPolicy || 'approval_required').trim().toLowerCase() as AssistantSkillRiskPolicy) ||
          'approval_required',
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

import type { AssistantSkillDefinition, ProviderCapabilities } from '../types';
import type { RuntimeIntentKind } from './types.types';
import type { RuntimeGenerationProfile } from './model-router.types';

type RoutingInput = {
  intentKind: RuntimeIntentKind;
  agentMode: 'basic' | 'advanced';
  capabilities: ProviderCapabilities;
  selectedSkill?: AssistantSkillDefinition;
};

export class ModelRouter {
  static selectGenerationProfile(input: RoutingInput): RuntimeGenerationProfile {
      const quality = input.capabilities.qualityTier;
      const lowContext = input.capabilities.maxContextTokens < 50_000;
      const readOnlySkill = input.selectedSkill?.riskPolicy === 'read_only';

      if (input.intentKind === 'factual_qa') {
        return {
          temperature: 0,
          maxTokens: lowContext ? 140 : 220,
          strategy: 'deterministic',
        };
      }

      if (input.intentKind === 'smalltalk' || input.intentKind === 'chat' || input.intentKind === 'unknown') {
        if (quality === 'local') {
          return {
            temperature: 0.25,
            maxTokens: lowContext ? 160 : 220,
            strategy: 'cheap_discovery',
          };
        }
        return {
          temperature: 0.35,
          maxTokens: input.agentMode === 'advanced' ? 320 : 260,
          strategy: 'balanced_chat',
        };
      }

      if (readOnlySkill) {
        return {
          temperature: 0.15,
          maxTokens: lowContext ? 180 : 260,
          strategy: 'cheap_discovery',
        };
      }

      return {
        temperature: input.agentMode === 'advanced' ? 0.2 : 0.15,
        maxTokens: lowContext ? 220 : 320,
        strategy: quality === 'high' ? 'high_reasoning' : 'balanced_chat',
      };

  }
}
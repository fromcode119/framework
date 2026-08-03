import { ModelStrategy } from '@ai/admin-assistant-runtime/enums/model-strategy.enum';
import { ModelQuality } from '@ai/admin-assistant-runtime/enums/model-quality.enum';
import { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IProviderCapabilities } from '@ai/admin-assistant-runtime/interfaces/provider-capabilities.interface';
import { RuntimeIntentKind } from '@ai/admin-assistant-runtime/runtime/enums/runtime-intent-kind.enum';
import type { RoutingInput } from '@ai/admin-assistant-runtime/runtime/routing-input';
import type { IRuntimeGenerationProfile } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-generation-profile.interface';

export class ModelRouter {
  static selectGenerationProfile(input: RoutingInput): IRuntimeGenerationProfile {
      const quality = input.capabilities.qualityTier;
      const lowContext = input.capabilities.maxContextTokens < 50_000;
      const readOnlySkill = input.selectedSkill?.riskPolicy === AssistantSkillRiskPolicy.READ_ONLY;

      if (input.intentKind === RuntimeIntentKind.FACTUAL_QA) {
        return {
          temperature: 0,
          maxTokens: lowContext ? 140 : 220,
          strategy: ModelStrategy.DETERMINISTIC,
        };
      }

      if (input.intentKind === RuntimeIntentKind.SMALLTALK || input.intentKind === RuntimeIntentKind.CHAT || input.intentKind === RuntimeIntentKind.UNKNOWN) {
        if (quality === ModelQuality.LOCAL) {
          return {
            temperature: 0.25,
            maxTokens: lowContext ? 160 : 220,
            strategy: ModelStrategy.CHEAP_DISCOVERY,
          };
        }
        return {
          temperature: 0.35,
          maxTokens: input.agentMode === ContextLevel.ADVANCED ? 320 : 260,
          strategy: ModelStrategy.BALANCED_CHAT,
        };
      }

      if (readOnlySkill) {
        return {
          temperature: 0.15,
          maxTokens: lowContext ? 180 : 260,
          strategy: ModelStrategy.CHEAP_DISCOVERY,
        };
      }

      return {
        temperature: input.agentMode === ContextLevel.ADVANCED ? 0.2 : 0.15,
        maxTokens: lowContext ? 220 : 320,
        strategy: quality === ModelQuality.HIGH ? ModelStrategy.HIGH_REASONING : ModelStrategy.BALANCED_CHAT,
      };

  }
}
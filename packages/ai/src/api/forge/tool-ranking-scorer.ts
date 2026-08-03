import { ToolFailureMode } from '@ai/api/forge/enums/tool-failure-mode.enum';
import { SpeedTier } from '@ai/api/forge/enums/speed-tier.enum';
import { CostTier } from '@ai/api/forge/enums/cost-tier.enum';
/**
 * Tool Ranking Scorer
 *
 * Stateless scoring/relevance helpers extracted from IntelligentToolSelector to
 * keep files under the line limit.
 */

import type { IToolMetadata } from '@ai/api/forge/interfaces/tool-metadata.interface';

import type { IToolWithMetadata } from '@ai/api/forge/interfaces/tool-with-metadata.interface';

import type { ITaskContext } from '@ai/api/forge/interfaces/task-context.interface';

export class ToolRankingScorer {
  static calculateRelevance(task: ITaskContext, tool: IToolWithMetadata, metadata: IToolMetadata): number {
    let score = 0;
    const taskWords = ToolRankingScorer.tokenize(task.taskDescription);
    const toolWords = ToolRankingScorer.tokenize(tool.description || '');

    // Word matching
    const matches = taskWords.filter((w) => toolWords.includes(w)).length;
    score += (matches / Math.max(taskWords.length, 1)) * 0.5;

    // Capability matching
    const relevantCapabilities = metadata.capabilities.filter((c) =>
      taskWords.some((w) => c.toLowerCase().includes(w) || w.includes(c.toLowerCase()))
    ).length;
    score += (relevantCapabilities / Math.max(metadata.capabilities.length, 1)) * 0.5;

    return Math.min(1, score);
  }

  static evaluateCostFitness(
    maxCost: CostTier | undefined,
    toolCost: CostTier
  ): number {
    if (!maxCost) return 1; // No constraint

    const costOrder = { cheap: 1, moderate: 2, expensive: 3 };
    const maxCostLevel = costOrder[maxCost.value];
    const toolCostLevel = costOrder[toolCost.value];

    return toolCostLevel <= maxCostLevel ? 1 : 0.2;
  }

  static evaluateLatencyFitness(
    maxLatency: SpeedTier | undefined,
    toolLatency: SpeedTier
  ): number {
    if (!maxLatency) return 1;

    const latencyOrder = { fast: 1, medium: 2, slow: 3 };
    const maxLatencyLevel = latencyOrder[maxLatency.value];
    const toolLatencyLevel = latencyOrder[toolLatency.value];

    return toolLatencyLevel <= maxLatencyLevel ? 1 : 0.5;
  }

  static generateRankingRationale(
    task: ITaskContext,
    tool: IToolWithMetadata,
    metadata: IToolMetadata,
    scores: { relevance: number; reliability: number; costFitness: number; latencyFitness: number }
  ): string {
    const parts: string[] = [];

    if (scores.relevance > 0.7) {
      parts.push('highly relevant to task');
    } else if (scores.relevance > 0.4) {
      parts.push('partially relevant');
    }

    if (scores.reliability > 0.8) {
      parts.push('very reliable');
    } else if (scores.reliability < 0.5) {
      parts.push('has history of failures');
    }

    if (scores.costFitness === 1) {
      parts.push(`${metadata.costEstimate} cost fits budget`);
    } else if (scores.costFitness < 1) {
      parts.push('exceeds cost constraints');
    }

    if (scores.latencyFitness < 1) {
      parts.push('may exceed latency budget');
    }

    return parts.join('; ') || 'Tool matches task criteria';
  }

  static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .match(/\b\w+\b/g) || [];
  }

  static createDefaultMetadata(toolName: string, description: string): IToolMetadata {
    return {
      name: toolName,
      capabilities: [toolName],
      prerequisites: [],
      costEstimate: CostTier.MODERATE,
      successRate: 0.7,
      similarTools: [],
      category: 'generic',
      latencyProfile: SpeedTier.MEDIUM,
      errorHandling: ToolFailureMode.RETRY,
    };
  }
}

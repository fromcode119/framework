/**
 * Tool Ranking Scorer
 *
 * Stateless scoring/relevance helpers extracted from IntelligentToolSelector to
 * keep files under the line limit.
 */

import type { ToolMetadata, ToolWithMetadata, TaskContext } from './intelligent-tool-selector.interfaces';

export class ToolRankingScorer {
  static calculateRelevance(task: TaskContext, tool: ToolWithMetadata, metadata: ToolMetadata): number {
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
    maxCost: 'cheap' | 'moderate' | 'expensive' | undefined,
    toolCost: 'cheap' | 'moderate' | 'expensive'
  ): number {
    if (!maxCost) return 1; // No constraint

    const costOrder = { cheap: 1, moderate: 2, expensive: 3 };
    const maxCostLevel = costOrder[maxCost];
    const toolCostLevel = costOrder[toolCost];

    return toolCostLevel <= maxCostLevel ? 1 : 0.2;
  }

  static evaluateLatencyFitness(
    maxLatency: 'fast' | 'medium' | 'slow' | undefined,
    toolLatency: 'fast' | 'medium' | 'slow'
  ): number {
    if (!maxLatency) return 1;

    const latencyOrder = { fast: 1, medium: 2, slow: 3 };
    const maxLatencyLevel = latencyOrder[maxLatency];
    const toolLatencyLevel = latencyOrder[toolLatency];

    return toolLatencyLevel <= maxLatencyLevel ? 1 : 0.5;
  }

  static generateRankingRationale(
    task: TaskContext,
    tool: ToolWithMetadata,
    metadata: ToolMetadata,
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

  static createDefaultMetadata(toolName: string, description: string): ToolMetadata {
    return {
      name: toolName,
      capabilities: [toolName],
      prerequisites: [],
      costEstimate: 'moderate',
      successRate: 0.7,
      similarTools: [],
      category: 'generic',
      latencyProfile: 'medium',
      errorHandling: 'retry',
    };
  }
}

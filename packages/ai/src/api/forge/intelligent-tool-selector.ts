/**
 * Intelligent Tool Selector
 * 
 * Smart tool selection based on task context, prerequisites, and historical success rates.
 */

import type { ToolMetadata, ToolWithMetadata, ToolRanking, TaskContext } from './intelligent-tool-selector.interfaces';

export class IntelligentToolSelector {
  private toolMetadata: Map<string, ToolMetadata> = new Map();
  private executionHistory: Array<{
    tool: string;
    success: boolean;
    timestamp: number;
    duration: number;
  }> = [];

  constructor(tools: ToolWithMetadata[]) {
    // Initialize tool metadata from available tools
    for (const tool of tools) {
      if (tool.metadata) {
        this.toolMetadata.set(tool.tool, tool.metadata);
      } else {
        // Create default metadata for tools without explicit metadata
        this.toolMetadata.set(tool.tool, this.createDefaultMetadata(tool.tool, tool.description || ''));
      }
    }
  }

  /**
   * Rank available tools for a specific task
   */
  rankToolsForTask(task: TaskContext, availableTools: ToolWithMetadata[]): ToolRanking[] {
    const rankings: ToolRanking[] = [];

    for (const tool of availableTools) {
      const metadata = this.toolMetadata.get(tool.tool);
      if (!metadata) continue;

      const relevance = this.calculateRelevance(task, tool, metadata);
      const reliability = this.calculateReliability(tool.tool, metadata);
      const costFitness = this.evaluateCostFitness(task.constraints?.maxCost, metadata.costEstimate);
      const latencyFitness = this.evaluateLatencyFitness(task.constraints?.maxLatency, metadata.latencyProfile);

      const score =
        relevance * 0.4 + // Relevance is most important
        reliability * 0.3 + // Reliability matters
        costFitness * 0.15 + // Cost efficiency
        latencyFitness * 0.15; // Latency budget

      const reasoning = this.generateRankingRationale(task, tool, metadata, {
        relevance,
        reliability,
        costFitness,
        latencyFitness,
      });

      rankings.push({
        toolName: tool.tool,
        score: Math.max(0, Math.min(1, score)),
        relevance,
        confidence: reliability,
        prerequisites: metadata.prerequisites,
        reasoning,
        alternatives: metadata.similarTools,
      });
    }

    // Sort by score (highest first)
    return rankings.sort((a, b) => b.score - a.score);
  }

  /**
   * Get recommended tool sequence for a complex task
   */
  getSuggestedToolSequence(
    goal: string,
    availableTools: ToolWithMetadata[],
    context: Record<string, any> = {}
  ): string[] {
    const taskContext: TaskContext = {
      taskDescription: goal,
      goal,
      availableContext: context,
    };

    const rankings = this.rankToolsForTask(taskContext, availableTools);

    // Filter tools with sufficient score
    const candidates = rankings.filter((r) => r.score > 0.4);

    if (candidates.length === 0) return [];

    // Build sequence respecting prerequisites
    const sequence: string[] = [];
    const completed = new Set<string>();

    while (sequence.length < candidates.length) {
      const tool = candidates.find((c) => {
        // Skip if already in sequence
        if (sequence.includes(c.toolName)) return false;

        // Check if all prerequisites are satisfied
        const unsatisfiedPrereqs = c.prerequisites.filter(
          (p) => !completed.has(p) && !sequence.includes(p)
        );

        return unsatisfiedPrereqs.length === 0;
      });

      if (!tool) break; // No more tools can be satisfied

      sequence.push(tool.toolName);
      completed.add(tool.toolName);
    }

    return sequence;
  }

  /**
   * Validate that prerequisites are met
   */
  validatePrerequisites(
    tool: string,
    completedTasks: Map<string, any>
  ): { valid: boolean; missing: string[] } {
    const metadata = this.toolMetadata.get(tool);
    if (!metadata) return { valid: true, missing: [] };

    const missing = metadata.prerequisites.filter((p) => !completedTasks.has(p));

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Record tool execution for history tracking
   */
  recordExecution(tool: string, success: boolean, duration: number): void {
    this.executionHistory.push({
      tool,
      success,
      timestamp: Date.now(),
      duration,
    });

    // Update success rate
    const metadata = this.toolMetadata.get(tool);
    if (metadata) {
      const toolExecutions = this.executionHistory.filter((h) => h.tool === tool);
      const successes = toolExecutions.filter((h) => h.success).length;
      metadata.successRate = successes / toolExecutions.length;
    }
  }

  /**
   * Get tool execution statistics
   */
  getToolStats(tool: string): {
    executions: number;
    successRate: number;
    averageDuration: number;
  } {
    const executions = this.executionHistory.filter((h) => h.tool === tool);
    const successes = executions.filter((h) => h.success).length;
    const avgDuration = executions.length > 0 ? executions.reduce((sum, h) => sum + h.duration, 0) / executions.length : 0;

    return {
      executions: executions.length,
      successRate: executions.length > 0 ? successes / executions.length : 0.5,
      averageDuration: avgDuration,
    };
  }

  /**
   * Find alternative tools with similar capabilities
   */
  findAlternativeTools(
    primaryTool: string,
    availableTools: ToolWithMetadata[]
  ): ToolWithMetadata[] {
    const metadata = this.toolMetadata.get(primaryTool);
    if (!metadata) return [];

    return availableTools.filter((tool) => {
      if (tool.tool === primaryTool) return false;
      const toolMeta = this.toolMetadata.get(tool.tool);
      if (!toolMeta) return false;

      // Check for overlapping capabilities
      const overlap = metadata.capabilities.filter((c) =>
        toolMeta.capabilities.includes(c)
      ).length;

      return overlap > 0;
    });
  }

  /**
   * Suggest tool swaps for failed execution
   */
  suggestToolSwap(
    failedTool: string,
    availableTools: ToolWithMetadata[]
  ): ToolRanking[] {
    const alternatives = this.findAlternativeTools(failedTool, availableTools);

    const taskContext: TaskContext = {
      taskDescription: `Alternative to ${failedTool}`,
      goal: `Complete task without using ${failedTool}`,
      availableContext: {},
    };

    return this.rankToolsForTask(taskContext, alternatives).filter((r) => r.score > 0.3);
  }

  // ==================== Private Methods ====================

  private calculateRelevance(task: TaskContext, tool: ToolWithMetadata, metadata: ToolMetadata): number {
    let score = 0;
    const taskWords = this.tokenize(task.taskDescription);
    const toolWords = this.tokenize(tool.description || '');

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

  private calculateReliability(tool: string, metadata: ToolMetadata): number {
    const stats = this.getToolStats(tool);
    return stats.successRate;
  }

  private evaluateCostFitness(
    maxCost: 'cheap' | 'moderate' | 'expensive' | undefined,
    toolCost: 'cheap' | 'moderate' | 'expensive'
  ): number {
    if (!maxCost) return 1; // No constraint

    const costOrder = { cheap: 1, moderate: 2, expensive: 3 };
    const maxCostLevel = costOrder[maxCost];
    const toolCostLevel = costOrder[toolCost];

    return toolCostLevel <= maxCostLevel ? 1 : 0.2;
  }

  private evaluateLatencyFitness(
    maxLatency: 'fast' | 'medium' | 'slow' | undefined,
    toolLatency: 'fast' | 'medium' | 'slow'
  ): number {
    if (!maxLatency) return 1;

    const latencyOrder = { fast: 1, medium: 2, slow: 3 };
    const maxLatencyLevel = latencyOrder[maxLatency];
    const toolLatencyLevel = latencyOrder[toolLatency];

    return toolLatencyLevel <= maxLatencyLevel ? 1 : 0.5;
  }

  private generateRankingRationale(
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

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .match(/\b\w+\b/g) || [];
  }

  private createDefaultMetadata(toolName: string, description: string): ToolMetadata {
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

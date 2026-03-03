/**
 * Enhanced Context Manager
 * 
 * Replaces the hard 24-message limit with intelligent, token-aware context management.
 * Preserves critical context while summarizing older conversations.
 */

export type MessageImportance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ContextFrame {
  messageId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  importance: MessageImportance;
  tokens: number; // Estimated token count
  timestamp: number;
  isCheckpointSummary?: boolean;
  metadata?: {
    toolsUsed?: string[];
    errorRecovery?: boolean;
    decision?: string;
    taskId?: string;
  };
}

export interface ContextSummary {
  periodStart: number;
  periodEnd: number;
  messageCount: number;
  keyDecisions: string[];
  completedTasks: string[];
  errors: { tool: string; message: string }[];
  systemState: Record<string, any>;
}

export class EnhancedContextManager {
  private frames: ContextFrame[] = [];
  private summaries: ContextSummary[] = [];
  private readonly maxTokens: number;
  private readonly criticalRetentionTokens: number;

  constructor(
    maxTokens: number = 8000, // Leave ~2K for response
    criticalRetentionTokens: number = 2000 // Always keep at least 2K of critical context
  ) {
    this.maxTokens = maxTokens;
    this.criticalRetentionTokens = criticalRetentionTokens;
  }

  /**
   * Add a new message to context with importance scoring
   */
  addFrame(
    role: 'system' | 'user' | 'assistant',
    content: string,
    importance: MessageImportance = 'MEDIUM',
    metadata?: ContextFrame['metadata']
  ): ContextFrame {
    const frame: ContextFrame = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      role,
      content,
      importance,
      tokens: this.estimateTokens(content),
      timestamp: Date.now(),
      metadata,
    };

    this.frames.push(frame);
    this.enforceTokenLimit();
    return frame;
  }

  /**
   * Get context frames suitable for LLM input
   * Returns in chronological order, respects token limits
   */
  getContextForLLM(): ContextFrame[] {
    let totalTokens = 0;
    const result: ContextFrame[] = [];

    // Start with most recent, work backwards
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const frame = this.frames[i];
      const newTotal = totalTokens + frame.tokens;

      if (newTotal <= this.maxTokens) {
        result.unshift(frame); // Keep chronological order
        totalTokens = newTotal;
      } else if (frame.importance === 'CRITICAL' && totalTokens < this.criticalRetentionTokens) {
        // Force include critical frames
        result.unshift(frame);
        totalTokens = newTotal;
      }
    }

    // Prepend any summaries if available
    if (this.summaries.length > 0) {
      const latestSummary = this.summaries[this.summaries.length - 1];
      const summaryContent = this.formatSummary(latestSummary);
      result.unshift({
        messageId: `summary_${latestSummary.periodEnd}`,
        role: 'system',
        content: summaryContent,
        importance: 'HIGH',
        tokens: this.estimateTokens(summaryContent),
        timestamp: latestSummary.periodEnd,
        isCheckpointSummary: true,
      });
    }

    return result;
  }

  /**
   * Score message importance based on content and context
   */
  scoreImportance(role: string, content: string, metadata?: ContextFrame['metadata']): MessageImportance {
    let score = 0;

    // Role-based baseline
    if (role === 'system') score += 2;
    else if (role === 'user') score += 1;
    else if (role === 'assistant') score += 0.5;

    // Content-based scoring
    if (content.length < 50) score += 0.5; // Short, likely important
    if (/error|fail|issue|problem/i.test(content)) score += 1.5;
    if (/decision|important|critical|must/i.test(content)) score += 2;
    if (/completed|finished|done|success/i.test(content)) score += 1;

    // Metadata-based
    if (metadata?.errorRecovery) score += 2;
    if (metadata?.decision) score += 1.5;
    if (metadata?.toolsUsed && metadata.toolsUsed.length > 0) score += 1;

    if (score >= 4) return 'CRITICAL';
    if (score >= 2.5) return 'HIGH';
    if (score >= 1) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Create checkpoint summary and clean up old frames
   */
  createCheckpoint(criteria: string = 'Task completed or significant progress'): ContextSummary {
    const summary = this.summarizeFrames(criteria);
    this.summaries.push(summary);

    // Remove low-priority old frames, keep recent ones
    this.frames = this.frames.filter((frame) => {
      const age = Date.now() - frame.timestamp;
      if (age < 5 * 60 * 1000) return true; // Keep if less than 5 minutes old
      if (frame.importance !== 'LOW') return true; // Keep non-low priority
      return false;
    });

    return summary;
  }

  /**
   * Get current memory stats
   */
  getStats(): {
    totalFrames: number;
    totalTokens: number;
    summaries: number;
    distribution: Record<MessageImportance, number>;
  } {
    const totalTokens = this.frames.reduce((sum, f) => sum + f.tokens, 0);
    const distribution = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    for (const frame of this.frames) {
      distribution[frame.importance]++;
    }

    return {
      totalFrames: this.frames.length,
      totalTokens,
      summaries: this.summaries.length,
      distribution,
    };
  }

  /**
   * Clear all context (start fresh session)
   */
  reset(): void {
    this.frames = [];
    this.summaries = [];
  }

  // ==================== Private Methods ====================

  private enforceTokenLimit(): void {
    let totalTokens = this.frames.reduce((sum, f) => sum + f.tokens, 0);

    if (totalTokens <= this.maxTokens) return;

    // Remove LOW priority frames first
    this.frames = this.frames.filter((f) => f.importance !== 'LOW');
    totalTokens = this.frames.reduce((sum, f) => sum + f.tokens, 0);

    if (totalTokens <= this.maxTokens) return;

    // Remove MEDIUM priority frames (but keep recent ones)
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    this.frames = this.frames.filter((f) => {
      if (f.importance !== 'MEDIUM') return true;
      return f.timestamp > fiveMinutesAgo;
    });

    totalTokens = this.frames.reduce((sum, f) => sum + f.tokens, 0);

    if (totalTokens <= this.maxTokens) return;

    // Last resort: keep only CRITICAL and most recent HIGH
    this.frames = this.frames
      .sort((a, b) => {
        if (a.importance === 'CRITICAL') return -1;
        if (b.importance === 'CRITICAL') return 1;
        return b.timestamp - a.timestamp;
      })
      .slice(0, Math.max(5, Math.floor(this.maxTokens / 200)));
  }

  private estimateTokens(content: string): number {
    // Rough estimate: ~1 token per 4 characters
    return Math.ceil(content.length / 4);
  }

  private summarizeFrames(criteria: string): ContextSummary {
    const now = Date.now();
    const keyDecisions: string[] = [];
    const completedTasks: string[] = [];
    const errors: { tool: string; message: string }[] = [];
    const systemState: Record<string, any> = {};

    for (const frame of this.frames) {
      if (frame.metadata?.decision) keyDecisions.push(frame.metadata.decision);
      if (frame.metadata?.taskId) completedTasks.push(frame.metadata.taskId);
      if (frame.metadata?.errorRecovery) {
        const tool = frame.metadata.toolsUsed?.[0] || 'unknown';
        errors.push({ tool, message: frame.content.substring(0, 100) });
      }
    }

    return {
      periodStart: this.frames[0]?.timestamp || now,
      periodEnd: now,
      messageCount: this.frames.length,
      keyDecisions,
      completedTasks,
      errors,
      systemState,
    };
  }

  private formatSummary(summary: ContextSummary): string {
    const lines = [
      '=== CONTEXT SUMMARY ===',
      `Period: ${new Date(summary.periodStart).toLocaleTimeString()} - ${new Date(summary.periodEnd).toLocaleTimeString()}`,
      `Messages: ${summary.messageCount}`,
    ];

    if (summary.keyDecisions.length > 0) {
      lines.push(`Key Decisions: ${summary.keyDecisions.join(', ')}`);
    }

    if (summary.completedTasks.length > 0) {
      lines.push(`Completed: ${summary.completedTasks.join(', ')}`);
    }

    if (summary.errors.length > 0) {
      lines.push(
        `Errors: ${summary.errors.map((e) => `${e.tool}: ${e.message}`).join(' | ')}`
      );
    }

    return lines.join('\n');
  }
}

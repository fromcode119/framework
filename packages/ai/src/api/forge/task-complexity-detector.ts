/**
 * Task Complexity Detector
 * 
 * Identifies simple, straightforward tasks that don't require planning passes.
 * Reduces AI overhead and improves response time for basic operations.
 */

export interface TaskComplexity {
  level: 'simple' | 'moderate' | 'complex';
  reason: string;
  skipPlanning: boolean;
  estimatedIterations: number;
  confidence: number; // 0-1
}

export class TaskComplexityDetector {
  /**
   * Detect task complexity from user message
   */
  detectComplexity(message: string, context?: {
    availableTools?: number;
    hasHistory?: boolean;
    agentMode?: string;
  }): TaskComplexity {
    const msg = String(message || '').trim().toLowerCase();
    
    // Pattern: simple text replacement (change X with Y, replace X by Y, etc)
    const simpleReplacePattern = /^(change|replace|update|rename|swap|substitute|find\s+and\s+replace)[\s\w\s'"]*with\s+/i;
    if (simpleReplacePattern.test(message)) {
      return {
        level: 'simple',
        reason: 'Simple text replacement operation',
        skipPlanning: true,
        estimatedIterations: 1,
        confidence: 0.95,
      };
    }

    // Pattern: single collection operation (create/update one item)
    const singleOpPattern = /^(create|add|make|set|update|modify)[\s+]*(a|an|the)?\s*(new\s+)?\w+\s+(in|on|for|with)?\s+/i;
    if (singleOpPattern.test(message) && !msg.includes('and') && !msg.includes('then') && !msg.includes('multiple')) {
      return {
        level: 'simple',
        reason: 'Single collection item operation',
        skipPlanning: true,
        estimatedIterations: 1,
        confidence: 0.85,
      };
    }

    // Pattern: simple lookup/search (no modifications)
    const lookupPattern = /^(find|search|list|show|get|retrieve|check|look(?:ing)?\s+for|find\s+all)\s+/i;
    if (lookupPattern.test(message) && !msg.includes('and create') && !msg.includes('and update')) {
      return {
        level: 'simple',
        reason: 'Simple lookup or search operation',
        skipPlanning: true,
        estimatedIterations: 1,
        confidence: 0.9,
      };
    }

    // Pattern: setting a config value
    const settingPattern = /^(set|change|update)[\s+]*(the\s+)?\w+\s+(setting|configuration|config|option|value)\s+(to|=|as)\s+/i;
    if (settingPattern.test(message)) {
      return {
        level: 'simple',
        reason: 'Single configuration setting change',
        skipPlanning: true,
        estimatedIterations: 1,
        confidence: 0.9,
      };
    }

    // Check for complexity indicators
    const complexityIndicators = {
      multiStep: ((message.match(/and\s+then|then\s+|next|after\s+that|also|multiple|bulk|batch|several/gi) || []).length > 2),
      conditional: (/if|when|unless|only\s+if|depending\s+on/i.test(message)),
      conditional2: (/then\s+if|then\s+when/i.test(message)),
      loop: (/for\s+each|for\s+all|every\s+\w+|all\s+\w+s?/i.test(message)),
      review: (/review|check|verify|validate|confirm/i.test(message)),
      refactor: (/refactor|reorganize|restructure|rewrite|redesign/i.test(message)),
      fuzzy: (/optimize|improve|better|cleaner|more\s+efficient/i.test(message) && !message.includes('performance')),
    };

    const complexityCount = Object.values(complexityIndicators).filter(Boolean).length;

    // Determine complexity level
    if (complexityCount === 0 && msg.length < 100) {
      return {
        level: 'simple',
        reason: 'Straightforward single operation',
        skipPlanning: true,
        estimatedIterations: 1,
        confidence: 0.92,
      };
    } else if (complexityCount <= 2 && msg.length < 200) {
      return {
        level: 'moderate',
        reason: 'Multi-step operation with some logic',
        skipPlanning: false,
        estimatedIterations: 2,
        confidence: 0.75,
      };
    } else {
      return {
        level: 'complex',
        reason: 'Complex multi-step operation requiring analysis',
        skipPlanning: false,
        estimatedIterations: 3,
        confidence: 0.8,
      };
    }
  }

  /**
   * Determine if planning pass should be skipped
   */
  shouldSkipPlanning(message: string, passNumber: number, previousContext?: any): boolean {
    const complexity = this.detectComplexity(message, previousContext);
    
    // Skip planning entirely for simple tasks
    if (complexity.skipPlanning && passNumber === 1) {
      return true;
    }

    // Never skip first real iteration for complex tasks
    if (complexity.level === 'complex') {
      return false;
    }

    // Skip only additional passes (passNumber > 1) for simple/moderate tasks
    return passNumber > 1;
  }

  /**
   * Get recommended max iterations based on complexity
   */
  getRecommendedMaxIterations(complexity: TaskComplexity): number {
    switch (complexity.level) {
      case 'simple':
        return 5; // extra headroom for staged-action completion without pause loops
      case 'moderate':
        return 7; // keep moderate tasks from prematurely pausing
      case 'complex':
        return 10; // full planning with recovery headroom
      default:
        return 7; // Fallback to moderate
    }
  }
}

/**
 * Reasoning Chain Tracker
 * 
 * Captures and tracks the AI's internal reasoning, decisions, and error recovery.
 * Provides full audit trail and enables backtracking on errors.
 */

export type StepType = 'analysis' | 'planning' | 'decision' | 'execution' | 'validation' | 'error-recovery';

export interface AlternativeOption {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface ReasoningStep {
  stepNumber: number;
  timestamp: number;
  type: StepType;
  input: Record<string, any>;
  thinking: string; // Internal reasoning
  output: Record<string, any>;
  confidence: number; // 0-1
  alternatives?: AlternativeOption[];
  selectedChoice?: AlternativeOption;
  duration?: number; // milliseconds
}

export interface RecoveryAttempt {
  attemptNumber: number;
  strategy: string; // Description of recovery strategy
  result: 'success' | 'failure';
  message?: string;
}

export interface ErrorRecovery {
  errorId: string;
  originalStepNumber: number;
  timestamp: number;
  errorMessage: string;
  errorType?: string; // 'timeout' | 'validation' | 'not-found' | etc
  recoveryAttempts: RecoveryAttempt[];
  recovered: boolean;
  finalStatus?: 'recovered' | 'abandoned' | 'escalated';
}

export interface ReasoningReport {
  totalSteps: number;
  successfulSteps: number;
  recoveries: ErrorRecovery[];
  averageConfidence: number;
  totalDuration: number;
  keyDecisions: string[];
  riskAssessment: 'low' | 'medium' | 'high';
}

export class ReasoningChainTracker {
  private steps: ReasoningStep[] = [];
  private errorRecoveries: Map<string, ErrorRecovery> = new Map();
  private currentStepNumber = 0;
  private sessionStartTime: number;

  constructor() {
    this.sessionStartTime = Date.now();
  }

  /**
   * Record a reasoning step in the chain
   */
  recordStep(
    type: StepType,
    thinking: string,
    input: Record<string, any>,
    output: Record<string, any>,
    confidence: number = 0.5,
    alternatives?: AlternativeOption[],
    selectedChoice?: AlternativeOption
  ): ReasoningStep {
    const step: ReasoningStep = {
      stepNumber: ++this.currentStepNumber,
      timestamp: Date.now(),
      type,
      thinking,
      input,
      output,
      confidence,
      alternatives,
      selectedChoice,
    };

    this.steps.push(step);
    return step;
  }

  /**
   * Record error and begin recovery tracking
   */
  startErrorRecovery(
    errorMessage: string,
    errorType?: string
  ): ErrorRecovery {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const recovery: ErrorRecovery = {
      errorId,
      originalStepNumber: this.currentStepNumber,
      timestamp: Date.now(),
      errorMessage,
      errorType,
      recoveryAttempts: [],
      recovered: false,
    };

    this.errorRecoveries.set(errorId, recovery);
    return recovery;
  }

  /**
   * Record a recovery attempt
   */
  recordRecoveryAttempt(
    errorId: string,
    strategy: string,
    result: 'success' | 'failure',
    message?: string
  ): RecoveryAttempt {
    const recovery = this.errorRecoveries.get(errorId);
    if (!recovery) throw new Error(`Unknown error ID: ${errorId}`);

    const attempt: RecoveryAttempt = {
      attemptNumber: recovery.recoveryAttempts.length + 1,
      strategy,
      result,
      message,
    };

    recovery.recoveryAttempts.push(attempt);
    if (result === 'success') {
      recovery.recovered = true;
      recovery.finalStatus = 'recovered';
    }

    return attempt;
  }

  /**
   * Mark error as abandoned or escalated
   */
  closeErrorRecovery(
    errorId: string,
    finalStatus: 'recovered' | 'abandoned' | 'escalated'
  ): void {
    const recovery = this.errorRecoveries.get(errorId);
    if (!recovery) throw new Error(`Unknown error ID: ${errorId}`);

    recovery.finalStatus = finalStatus;
    if (finalStatus === 'recovered') {
      recovery.recovered = true;
    }
  }

  /**
   * Backtrack to a previous step and continue from there
   */
  backtrackToStep(stepNumber: number): ReasoningStep | null {
    if (stepNumber < 1 || stepNumber >= this.steps.length) {
      return null; // Invalid step number
    }

    const backtrackStep = this.steps[stepNumber - 1];
    const stepsToRemove = this.steps.length - stepNumber;

    // Remove steps after backtrack point
    this.steps.splice(stepNumber);
    this.currentStepNumber = stepNumber;

    return {
      ...backtrackStep,
      thinking: `[BACKTRACKED TO STEP ${stepNumber}] ${backtrackStep.thinking}`,
    };
  }

  /**
   * Get reasoning history up to current point
   */
  getReasoningHistory(limit?: number): ReasoningStep[] {
    if (!limit) return [...this.steps];
    return this.steps.slice(-limit);
  }

  /**
   * Find a specific step by number
   */
  getStep(stepNumber: number): ReasoningStep | null {
    const step = this.steps.find((s) => s.stepNumber === stepNumber);
    return step || null;
  }

  /**
   * Get all error recoveries
   */
  getErrorRecoveries(): ErrorRecovery[] {
    return Array.from(this.errorRecoveries.values());
  }

  /**
   * Calculate confidence across the chain
   */
  getAverageConfidence(): number {
    if (this.steps.length === 0) return 0;
    const total = this.steps.reduce((sum, s) => sum + s.confidence, 0);
    return total / this.steps.length;
  }

  /**
   * Generate comprehensive reasoning report
   */
  generateReport(): ReasoningReport {
    const recoveries = Array.from(this.errorRecoveries.values());
    const successfulRecoveries = recoveries.filter((r) => r.recovered).length;
    const failedRecoveries = recoveries.length - successfulRecoveries;

    const totalDuration = Date.now() - this.sessionStartTime;
    const averageConfidence = this.getAverageConfidence();

    // Extract key decisions
    const keyDecisions = this.steps
      .filter((s) => s.type === 'decision' && s.selectedChoice)
      .map((s) => `${s.selectedChoice?.description}`)
      .filter((d) => d);

    // Assess overall risk
    let riskScore = 0;
    if (failedRecoveries > 0) riskScore += 1;
    if (averageConfidence < 0.6) riskScore += 1;
    if (recoveries.length > 2) riskScore += 1;

    const riskAssessment: 'low' | 'medium' | 'high' =
      riskScore === 0 ? 'low' : riskScore === 1 ? 'medium' : 'high';

    return {
      totalSteps: this.steps.length,
      successfulSteps: this.steps.filter((s) => s.type !== 'error-recovery').length,
      recoveries,
      averageConfidence,
      totalDuration,
      keyDecisions,
      riskAssessment,
    };
  }

  /**
   * Generate human-readable reasoning report
   */
  generateReasoningReport(): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push('=== REASONING CHAIN REPORT ===');
    lines.push(`Total Steps: ${report.totalSteps}`);
    lines.push(`Successful: ${report.successfulSteps}/${report.totalSteps}`);
    lines.push(`Average Confidence: ${(report.averageConfidence * 100).toFixed(1)}%`);
    lines.push(`Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
    lines.push(`Risk Assessment: ${report.riskAssessment.toUpperCase()}`);

    if (report.keyDecisions.length > 0) {
      lines.push('\nKey Decisions:');
      report.keyDecisions.forEach((d) => lines.push(`  - ${d}`));
    }

    if (report.recoveries.length > 0) {
      lines.push('\nError Recoveries:');
      report.recoveries.forEach((r) => {
        const status = r.recovered ? '✓' : '✗';
        lines.push(
          `  ${status} [Step ${r.originalStepNumber}] ${r.errorType || 'Unknown'}: ${r.errorMessage.substring(0, 50)}`
        );
        r.recoveryAttempts.forEach((a) => {
          lines.push(`      → Attempt ${a.attemptNumber}: ${a.strategy} (${a.result})`);
        });
      });
    }

    return lines.join('\n');
  }

  /**
   * Get recent steps with context
   */
  getContextWindow(windowSize: number = 10): ReasoningStep[] {
    const start = Math.max(0, this.steps.length - windowSize);
    return this.steps.slice(start);
  }

  /**
   * Find steps by type
   */
  getStepsByType(type: StepType): ReasoningStep[] {
    return this.steps.filter((s) => s.type === type);
  }

  /**
   * Get decision points with alternatives
   */
  getDecisionPoints(): ReasoningStep[] {
    return this.steps.filter((s) => s.type === 'decision' && s.alternatives && s.alternatives.length > 0);
  }

  /**
   * Calculate recovery rate
   */
  getRecoveryRate(): number {
    const recoveries = Array.from(this.errorRecoveries.values());
    if (recoveries.length === 0) return 1.0; // 100% if no errors
    const successful = recoveries.filter((r) => r.recovered).length;
    return successful / recoveries.length;
  }

  /**
   * Reset the tracker (start fresh session)
   */
  reset(): void {
    this.steps = [];
    this.errorRecoveries.clear();
    this.currentStepNumber = 0;
    this.sessionStartTime = Date.now();
  }
}

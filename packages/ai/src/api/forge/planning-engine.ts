/**
 * Planning Engine
 * 
 * Decomposes complex tasks into structured plans with checkpoints and dependencies.
 */

import type { TaskStatus } from './planning-engine.types';
import type { Subtask, Checkpoint, TaskDependency, TaskPlan, ExecutionResult } from './planning-engine.interfaces';

export class PlanningEngine {
  private plans: Map<string, TaskPlan> = new Map();
  private completionCallbacks: Map<string, (result: ExecutionResult) => void> = new Map();

  /**
   * Generate a structured plan for a complex goal
   */
  generatePlan(
    goal: string,
    context: { availableTools: string[]; systemState: Record<string, any> }
  ): TaskPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // This would be enhanced by AI to actually decompose tasks,
    // but here's the structure:
    const plan: TaskPlan = {
      id: planId,
      goalStatement: goal,
      subtasks: [],
      dependencies: [],
      checkpoints: [],
      createdAt: Date.now(),
      estimatedTotalDuration: 0,
      status: 'not-started',
    };

    this.plans.set(planId, plan);
    return plan;
  }

  /**
   * Add subtask to a plan
   */
  addSubtask(
    planId: string,
    title: string,
    description: string,
    requiredTools: string[],
    expectedOutput: string,
    priority: number = 5,
    estimatedDuration?: number,
    parentTaskId?: string
  ): Subtask {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const subtask: Subtask = {
      id: `task_${planId}_${plan.subtasks.length}`,
      title,
      description,
      requiredTools,
      expectedOutput,
      status: 'pending',
      priority,
      estimatedDuration,
      parentTaskId,
      maxRetries: 3,
    };

    plan.subtasks.push(subtask);
    if (estimatedDuration) {
      plan.estimatedTotalDuration += estimatedDuration;
    }

    return subtask;
  }

  /**
   * Add dependency between two subtasks
   */
  addDependency(planId: string, fromTaskId: string, toTaskId: string, reason: string): void {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    plan.dependencies.push({
      from: fromTaskId,
      to: toTaskId,
      reason,
    });
  }

  /**
   * Add checkpoint after a subtask
   */
  addCheckpoint(
    planId: string,
    title: string,
    afterSubtaskId: string,
    verificationCriteria: string,
    state: Record<string, any>
  ): Checkpoint {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const checkpoint: Checkpoint = {
      id: `checkpoint_${planId}_${plan.checkpoints.length}`,
      title,
      afterSubtaskId,
      verificationCriteria,
      savedState: state,
      timestamp: Date.now(),
      verified: false,
    };

    plan.checkpoints.push(checkpoint);
    return checkpoint;
  }

  /**
   * Get next executable subtask(s)
   */
  getNextExecutableTasks(planId: string): Subtask[] {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    if (plan.status === 'completed' || plan.status === 'failed' || plan.status === 'abandoned') {
      return [];
    }

    const completedIds = new Set(
      plan.subtasks.filter((t) => t.status === 'completed').map((t) => t.id)
    );

    const executable = plan.subtasks.filter((task) => {
      // Must be pending
      if (task.status !== 'pending') return false;

      // All dependencies must be completed
      const deps = plan.dependencies.filter((d) => d.to === task.id);
      return deps.every((d) => completedIds.has(d.from));
    });

    // Sort by priority (higher first)
    return executable.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Mark subtask as complete
   */
  completeSubtask(
    planId: string,
    subtaskId: string,
    result: Record<string, any>,
    duration: number
  ): ExecutionResult {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const task = plan.subtasks.find((t) => t.id === subtaskId);
    if (!task) throw new Error(`Subtask not found: ${subtaskId}`);

    task.status = 'completed';
    task.result = result;
    task.actualDuration = duration;

    // Check if all tasks are completed
    if (plan.subtasks.every((t) => t.status === 'completed' || t.status === 'skipped')) {
      plan.status = 'completed';
      plan.actualTotalDuration = Date.now() - plan.createdAt;
    }

    const executionResult: ExecutionResult = {
      success: true,
      subtaskId,
      output: result,
      duration,
    };

    // Call any registered callback
    const callback = this.completionCallbacks.get(subtaskId);
    if (callback) callback(executionResult);

    return executionResult;
  }

  /**
   * Mark subtask as failed
   */
  failSubtask(planId: string, subtaskId: string, error: string, duration: number): ExecutionResult {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const task = plan.subtasks.find((t) => t.id === subtaskId);
    if (!task) throw new Error(`Subtask not found: ${subtaskId}`);

    const attempt = (task.retryCount || 0) + 1;
    task.retryCount = attempt;

    if (attempt >= (task.maxRetries || 3)) {
      task.status = 'failed';
      plan.status = 'failed';
    } else {
      task.status = 'pending'; // Retry
    }

    task.error = error;
    task.actualDuration = duration;

    const executionResult: ExecutionResult = {
      success: false,
      subtaskId,
      error,
      duration,
    };

    // Call any registered callback
    const callback = this.completionCallbacks.get(subtaskId);
    if (callback) callback(executionResult);

    return executionResult;
  }

  /**
   * Verify a checkpoint
   */
  verifyCheckpoint(planId: string, checkpointId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const checkpoint = plan.checkpoints.find((c) => c.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint not found: ${checkpointId}`);

    checkpoint.verified = true;
    return true;
  }

  /**
   * Get plan status
   */
  getPlanStatus(planId: string): {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
    progress: number;
  } {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const total = plan.subtasks.length;
    const completed = plan.subtasks.filter((t) => t.status === 'completed').length;
    const inProgress = plan.subtasks.filter((t) => t.status === 'in-progress').length;
    const pending = plan.subtasks.filter((t) => t.status === 'pending').length;
    const failed = plan.subtasks.filter((t) => t.status === 'failed').length;

    return {
      total,
      completed,
      inProgress,
      pending,
      failed,
      progress: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  /**
   * Get plan details
   */
  getPlan(planId: string): TaskPlan | null {
    return this.plans.get(planId) || null;
  }

  /**
   * Generate plan summary
   */
  generatePlanSummary(planId: string): string {
    const plan = this.plans.get(planId);
    if (!plan) return `Plan not found: ${planId}`;

    const status = this.getPlanStatus(planId);
    const lines: string[] = [];

    lines.push('=== TASK PLAN SUMMARY ===');
    lines.push(`Goal: ${plan.goalStatement}`);
    lines.push(`Status: ${plan.status.toUpperCase()}`);
    lines.push(`Progress: ${status.completed}/${status.total} (${status.progress.toFixed(1)}%)`);

    if (status.failed > 0) {
      lines.push(`⚠️  Failed: ${status.failed} task(s)`);
    }

    if (plan.subtasks.length > 0) {
      lines.push('\nSubtasks:');
      plan.subtasks.forEach((t) => {
        const icon =
          t.status === 'completed' ? '✓' : t.status === 'failed' ? '✗' : '○';
        lines.push(`  ${icon} [${t.priority}/10] ${t.title} (${t.status})`);
      });
    }

    if (plan.checkpoints.length > 0) {
      lines.push('\nCheckpoints:');
      plan.checkpoints.forEach((c) => {
        const icon = c.verified ? '✓' : '○';
        lines.push(`  ${icon} ${c.title}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Abandon plan
   */
  abandonPlan(planId: string, reason: string): void {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);
    plan.status = 'abandoned';
  }

  /**
   * Reset all plans
   */
  reset(): void {
    this.plans.clear();
    this.completionCallbacks.clear();
  }
}

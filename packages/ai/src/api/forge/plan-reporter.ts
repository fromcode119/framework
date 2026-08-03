import { TaskProgress } from '@ai/api/forge/enums/task-progress.enum';
import { TaskStatus } from '@ai/api/forge/enums/task-status.enum';
/**
 * Plan Reporter
 *
 * Stateless reporting/summary helpers extracted from PlanningEngine to keep
 * files under the line limit. Operates on a resolved TaskPlan.
 */

import type { ITaskPlan } from '@ai/api/forge/interfaces/task-plan.interface';

import type { IPlanStatusSummary } from '@ai/api/forge/interfaces/plan-status-summary.interface';

export class PlanReporter {
  /**
   * Compute plan status counts and progress for a plan.
   */
  static getPlanStatus(plan: ITaskPlan): IPlanStatusSummary {
    const total = plan.subtasks.length;
    const completed = plan.subtasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const inProgress = plan.subtasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const pending = plan.subtasks.filter((t) => t.status === TaskStatus.PENDING).length;
    const failed = plan.subtasks.filter((t) => t.status === TaskStatus.FAILED).length;

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
   * Generate a human-readable plan summary.
   */
  static generatePlanSummary(plan: ITaskPlan): string {
    const status = PlanReporter.getPlanStatus(plan);
    const lines: string[] = [];

    lines.push('=== TASK PLAN SUMMARY ===');
    lines.push(`Goal: ${plan.goalStatement}`);
    lines.push(`Status: ${TaskProgress.resolve(plan.status).value.toUpperCase()}`);
    lines.push(`Progress: ${status.completed}/${status.total} (${status.progress.toFixed(1)}%)`);

    if (status.failed > 0) {
      lines.push(`⚠️  Failed: ${status.failed} task(s)`);
    }

    if (plan.subtasks.length > 0) {
      lines.push('\nSubtasks:');
      plan.subtasks.forEach((t) => {
        const icon =
          t.status === TaskStatus.COMPLETED ? '✓' : t.status === TaskStatus.FAILED ? '✗' : '○';
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
}

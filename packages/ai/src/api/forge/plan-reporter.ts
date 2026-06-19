/**
 * Plan Reporter
 *
 * Stateless reporting/summary helpers extracted from PlanningEngine to keep
 * files under the line limit. Operates on a resolved TaskPlan.
 */

import type { TaskPlan, PlanStatusSummary } from './planning-engine.interfaces';

export class PlanReporter {
  /**
   * Compute plan status counts and progress for a plan.
   */
  static getPlanStatus(plan: TaskPlan): PlanStatusSummary {
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
   * Generate a human-readable plan summary.
   */
  static generatePlanSummary(plan: TaskPlan): string {
    const status = PlanReporter.getPlanStatus(plan);
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
}

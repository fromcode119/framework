import { Request, Response } from 'express';
import { TypeUtils } from '@fromcode119/core';
import type { ControllerDeps } from './controller-deps';

/** Handles the executeAssistantActions endpoint logic. */
export class ExecuteActionsHandler {
  static async handle(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    const startedAt = Date.now();
    try {
      const normalizedBody = deps.payloadService.normalizeLegacyAssistantExecutePayload(req.body || {});
      const usedLegacyContract = deps.payloadService.isLegacyAssistantExecutePayload(req.body || {});
      if (usedLegacyContract) deps.setAssistantDeprecationHeaders(res, '/api/forge/admin/assistant/actions/execute');
      (req as any).body = normalizedBody;
      const validationError = deps.payloadService.validateAssistantExecutePayload(normalizedBody || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const dryRun = TypeUtils.parseBoolean(normalizedBody?.dryRun) !== false;
      const sessionId = deps.sessions.normalizeSessionId(normalizedBody?.sessionId);
      const requestedBatchId = String(normalizedBody?.batchId || '').trim() || undefined;
      const actions = Array.isArray(normalizedBody?.actions) ? normalizedBody.actions : [];

      const toolValidationStats = { preValidated: 0, recommended: 0, risks: [] as string[] };
      for (const action of actions) {
        const toolName = String(action?.tool || '').trim();
        if (toolName) {
          deps.toolSelector.recordExecution(toolName, false, 0);
          toolValidationStats.preValidated++;
          if (sessionId) deps.recordReasoningStep(sessionId, `Pre-validating action: ${toolName}`, { tool: toolName, action }, { validated: true }, 0.9);
        }
      }

      const runtime = deps.createAssistantRuntime(req);
      const result = await runtime.executeActions({ actions, dryRun, context: { user: (req as any).user, headers: req.headers, cookies: (req as any).cookies } });

      const successCount = Array.isArray(result?.results) ? result.results.filter((item: any) => item?.ok).length : 0;
      const executionItems = Array.isArray(result?.results) ? result.results : [];
      const summary = executionItems.reduce((acc: { ok: number; unchanged: number; failed: number }, item: any) => {
        const output = item?.output && typeof item.output === 'object' ? item.output : null;
        const changedFields = Array.isArray(output?.changedFields) ? output.changedFields : [];
        const errorText = String(item?.error || '').toLowerCase();
        const unchanged = output?.skipped === true || errorText.includes('no values to set') || (item?.tool === 'content.update' && changedFields.length === 0 && item?.ok !== false);
        if (unchanged) { acc.unchanged += 1; return acc; }
        if (item?.ok === false) { acc.failed += 1; return acc; }
        acc.ok += 1; return acc;
      }, { ok: 0, unchanged: 0, failed: 0 });
      const batchState = (dryRun ? 'previewed' : 'applied') as 'previewed' | 'applied';

      if (sessionId && result?.results) {
        deps.recordReasoningStep(sessionId, `Executed ${actions.length} actions with ${successCount} successes`, { actionCount: actions.length }, { results: result.results, successCount }, successCount / Math.max(1, actions.length));
        const existingSession = await deps.sessions.load(sessionId);
        if (existingSession) {
          await deps.sessions.save(sessionId, { ...existingSession, updatedAt: Date.now(), sandboxMode: dryRun, lastExecution: { dryRun, results: executionItems, executedBatchId: requestedBatchId || null, batchState, executionSummary: summary, toolValidationStats, reasoningReport: deps.getReasoningReport(sessionId) || null } });
        }
      }

      await deps.emitAssistantTelemetry('actions.execute', { sessionId: sessionId || null, usedLegacyContract, dryRun, actions: actions.length, results: executionItems.length, ok: successCount, unchanged: summary.unchanged, failed: summary.failed, batch_state_transition: requestedBatchId ? `staged->${batchState}` : null, preValidated: toolValidationStats.preValidated, durationMs: Date.now() - startedAt });
      return res.json({ ...result, executedBatchId: requestedBatchId, batchState, executionSummary: summary });
    } catch (e: any) {
      if (/actions are required/i.test(String(e?.message || ''))) {
        return res.status(400).json({ error: 'actions are required' });
      }
      await deps.emitAssistantTelemetry('actions.execute.failed', { error: String(e?.message || 'Assistant action execution failed'), durationMs: Date.now() - startedAt });
      return res.status(500).json({ error: e?.message || 'Assistant action execution failed' });
    }
  }
}

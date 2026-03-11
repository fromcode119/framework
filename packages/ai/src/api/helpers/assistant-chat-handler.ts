import { Request, Response } from 'express';
import { TypeUtils } from '@fromcode119/core';
import type { ControllerDeps } from './controller-deps';

/** Handles the assistantChat endpoint logic. */
export class AssistantChatHandler {
  static async handle(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    const startedAt = Date.now();
    try {
      const normalizedBody = deps.payloadService.normalizeLegacyAssistantChatPayload(req.body || {});
      const usedLegacyContract = deps.payloadService.isLegacyAssistantChatPayload(req.body || {});
      if (usedLegacyContract) deps.setAssistantDeprecationHeaders(res, '/api/forge/admin/assistant/chat');
      (req as any).body = normalizedBody;
      const validationError = deps.payloadService.validateAssistantChatPayload(normalizedBody || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const message = String(normalizedBody?.message || '').trim();
      const sessionId = deps.sessions.normalizeSessionId(normalizedBody?.sessionId);
      const incomingHistory = deps.sessions.normalizeHistory(normalizedBody?.history);
      const existingSession = sessionId ? await deps.sessions.load(sessionId) : null;
      const history = incomingHistory.length ? incomingHistory : deps.sessions.normalizeHistory(existingSession?.history);

      if (deps.catalog.isInventoryQuery(message)) {
        const assistantMessage = deps.catalog.buildInventoryMessage();
        const respPayload = { message: assistantMessage, actions: [] as any[], traces: [], done: true, sessionId: sessionId || undefined, model: String(normalizedBody?.config?.model || '').trim() || String(existingSession?.model || '').trim() || '', skill: { id: String(normalizedBody?.skillId || existingSession?.skillId || 'general').trim().toLowerCase() || 'general' }, agentMode: String(normalizedBody?.agentMode || existingSession?.agentMode || 'advanced').trim() || 'advanced', ui: { canContinue: false, requiresApproval: false, suggestedMode: 'chat' }, provider: String(normalizedBody?.provider || existingSession?.provider || 'openai').trim().toLowerCase() || 'openai' };
        if (sessionId) {
          const nextHistory = deps.sessions.normalizeHistory([...history, { role: 'user', content: message }, { role: 'assistant', content: assistantMessage }]);
          await deps.sessions.save(sessionId, { id: sessionId, title: String(existingSession?.title || '').trim() || deps.sessions.summarizeTitle(nextHistory), updatedAt: Date.now(), provider: respPayload.provider, model: respPayload.model, agentMode: respPayload.agentMode, skillId: respPayload.skill.id, tools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : existingSession?.tools || [], sandboxMode: TypeUtils.parseBoolean(normalizedBody?.dryRun) !== false, config: { ...(existingSession?.config || {}), ...(normalizedBody?.config || {}) }, history: nextHistory, lastPlan: null, lastUi: respPayload.ui, lastActions: [], lastCheckpoint: null });
        }
        await deps.emitAssistantTelemetry('chat.inventory.shortcut', { provider: respPayload.provider, sessionId: sessionId || null, usedLegacyContract, durationMs: Date.now() - startedAt });
        return res.json(respPayload);
      }

      const inboxFormsIntent = deps.catalog.detectInboxFormsQuery(message);
      if (inboxFormsIntent) {
        const assistantMessage = await deps.catalog.buildInboxFormsMessage(req, inboxFormsIntent);
        const respPayload = { message: assistantMessage, actions: [] as any[], traces: [], done: true, sessionId: sessionId || undefined, model: String(normalizedBody?.config?.model || '').trim() || String(existingSession?.model || '').trim() || '', skill: { id: String(normalizedBody?.skillId || existingSession?.skillId || 'general').trim().toLowerCase() || 'general' }, agentMode: String(normalizedBody?.agentMode || existingSession?.agentMode || 'advanced').trim() || 'advanced', ui: { canContinue: false, requiresApproval: false, suggestedMode: 'chat' }, provider: String(normalizedBody?.provider || existingSession?.provider || 'openai').trim().toLowerCase() || 'openai' };
        if (sessionId) {
          const nextHistory = deps.sessions.normalizeHistory([...history, { role: 'user', content: message }, { role: 'assistant', content: assistantMessage }]);
          await deps.sessions.save(sessionId, { id: sessionId, title: String(existingSession?.title || '').trim() || deps.sessions.summarizeTitle(nextHistory), updatedAt: Date.now(), provider: respPayload.provider, model: respPayload.model, agentMode: respPayload.agentMode, skillId: respPayload.skill.id, tools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : existingSession?.tools || [], sandboxMode: TypeUtils.parseBoolean(normalizedBody?.dryRun) !== false, config: { ...(existingSession?.config || {}), ...(normalizedBody?.config || {}) }, history: nextHistory, lastPlan: null, lastUi: respPayload.ui, lastActions: [], lastCheckpoint: null });
        }
        await deps.emitAssistantTelemetry('chat.scope.shortcut', { provider: respPayload.provider, sessionId: sessionId || null, usedLegacyContract, scope: inboxFormsIntent.emails && inboxFormsIntent.forms ? 'emails+forms' : inboxFormsIntent.emails ? 'emails' : 'forms', durationMs: Date.now() - startedAt });
        return res.json(respPayload);
      }

      const resolvedAssistant = await deps.resolveAssistantClientFromRequest(req);
      const aiClient = resolvedAssistant.client;
      if (!aiClient || typeof aiClient.chat !== 'function') {
        return res.status(400).json({ error: 'AI Assistant integration is not configured. Set it in Settings > Integrations > AI Assistant.' });
      }

      const runtime = deps.createAssistantRuntime(req, aiClient);
      const taskComplexity = deps.complexityDetector.detectComplexity(message, { availableTools: (normalizedBody?.tools || []).length > 0 ? (normalizedBody.tools as any[]).length : 5, hasHistory: history && history.length > 0, agentMode: String(normalizedBody?.agentMode || 'advanced') });
      const complexityAdjustedIterations = Math.min(Number(normalizedBody?.maxIterations || 8), deps.complexityDetector.getRecommendedMaxIterations(taskComplexity));
      const contextForLLM = await deps.prepareContextForLLM(sessionId, history);
      deps.recordReasoningStep(sessionId, `Processing: ${message.substring(0, 100)}... [${taskComplexity.level} task]`, { sessionId, agentMode: normalizedBody?.agentMode, complexity: taskComplexity.level }, {}, taskComplexity.confidence);
      const requestCheckpoint = deps.normalizeAssistantCheckpoint(normalizedBody?.checkpoint || existingSession?.lastCheckpoint);
      const requestContinueFrom = TypeUtils.parseBoolean(normalizedBody?.continueFrom) === true || requestCheckpoint?.reason === 'clarification_needed' || requestCheckpoint?.reason === 'loop_recovery';

      const result = await runtime.chat({ message, provider: resolvedAssistant.provider, history: contextForLLM, agentMode: String(normalizedBody?.agentMode || 'advanced'), maxIterations: complexityAdjustedIterations, maxDurationMs: Number(normalizedBody?.maxDurationMs || 35000), allowedTools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : [], skillId: String(normalizedBody?.skillId || '').trim() || undefined, sessionId: sessionId || undefined, continueFrom: requestContinueFrom, checkpoint: requestCheckpoint } as any);

      let finalResult = result;
      const pausedWithoutActions = taskComplexity.level === 'simple' && result?.ui?.canContinue === true && result?.ui?.needsClarification !== true && (!Array.isArray(result?.actions) || result.actions.length === 0);
      if (pausedWithoutActions) {
        const continuationPrompt = String(result?.checkpoint?.resumePrompt || '').trim() || 'Continue planning from previous context and stage executable actions if safe.';
        deps.recordReasoningStep(sessionId, 'Simple task paused without actions; running one automatic continuation pass', { complexity: taskComplexity.level, originalMessage: message }, { continuationPrompt }, 0.9);
        const continued = await runtime.chat({ message: continuationPrompt, provider: resolvedAssistant.provider, history: contextForLLM, agentMode: String(normalizedBody?.agentMode || 'advanced'), maxIterations: Math.max(2, complexityAdjustedIterations), maxDurationMs: Number(normalizedBody?.maxDurationMs || 35000), allowedTools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : [], skillId: String(normalizedBody?.skillId || '').trim() || undefined, sessionId: sessionId || undefined, continueFrom: true, checkpoint: deps.normalizeAssistantCheckpoint(result?.checkpoint) } as any);
        if (continued && typeof continued === 'object') finalResult = continued;
      }
      deps.recordReasoningStep(sessionId, 'Completed: Got response from runtime', { agentMode: normalizedBody?.agentMode }, { success: !!finalResult?.message }, 0.8);

      const responsePayload = { ...finalResult, provider: resolvedAssistant.provider, sessionId: sessionId || finalResult.sessionId } as any;
      if (sessionId) {
        const nextHistory = deps.sessions.normalizeHistory([...history, { role: 'user', content: message }, { role: 'assistant', content: String(finalResult?.message || '').trim() || 'No response generated.' }]);
        await deps.sessions.save(sessionId, { id: sessionId, title: String(existingSession?.title || '').trim() || deps.sessions.summarizeTitle(nextHistory), updatedAt: Date.now(), provider: resolvedAssistant.provider, model: String(finalResult?.model || '').trim() || String(existingSession?.model || '').trim() || '', agentMode: String(normalizedBody?.agentMode || existingSession?.agentMode || 'advanced').trim(), skillId: String(normalizedBody?.skillId || existingSession?.skillId || 'general').trim().toLowerCase() || 'general', tools: Array.isArray(normalizedBody?.tools) ? normalizedBody.tools : existingSession?.tools || [], sandboxMode: TypeUtils.parseBoolean(normalizedBody?.dryRun) !== false, config: { ...(existingSession?.config || {}), ...(normalizedBody?.config || {}) }, history: nextHistory, lastPlan: finalResult?.plan || null, lastUi: finalResult?.ui || null, lastActions: Array.isArray(finalResult?.actions) ? finalResult.actions : [], lastCheckpoint: finalResult?.checkpoint || null, lastActionBatchState: String(finalResult?.actionBatch?.state || existingSession?.lastActionBatchState || '').trim() || null, reasoningReport: deps.getReasoningReport(sessionId) || null });
      }

      const reasoningStats = sessionId && deps.activeSessions.get(sessionId) ? deps.activeSessions.get(sessionId)!.reasoning.generateReport() : null;
      const reasoningReport = deps.getReasoningReport(sessionId) || null;
      const finalMessage = String(finalResult?.message || '');
      const durationMs = Date.now() - startedAt;
      await deps.emitAssistantTelemetry('chat.success', { provider: resolvedAssistant.provider, sessionId: sessionId || finalResult?.sessionId || null, usedLegacyContract, agentMode: String(finalResult?.agentMode || '').trim() || 'advanced', skillId: String(finalResult?.skill?.id || normalizedBody?.skillId || '').trim() || 'general', iterations: Number(finalResult?.iterations || 0) || 0, actions: Array.isArray(finalResult?.actions) ? finalResult.actions.length : 0, loopCapReached: finalResult?.loopCapReached === true, durationMs, reasoningSteps: reasoningStats?.totalSteps || 0, averageConfidence: reasoningStats?.averageConfidence || 0, errorRecoveries: reasoningStats?.recoveries?.length || 0, pause_count_per_request: (finalMessage.match(/one more pass|continue planning|planning paused/gi) || []).length + (finalResult?.ui?.canContinue === true ? 1 : 0), repeated_pause_copy_detected: finalResult?.ui?.loopRecoveryMode === 'best_effort', draft_fast_path_used: Array.isArray(finalResult?.traces) ? finalResult.traces.some((t: any) => /draft fast-path/i.test(String(t?.message || ''))) : false, clarification_vs_continue_rate: finalResult?.ui?.needsClarification === true ? 1 : finalResult?.ui?.canContinue === true ? 0 : null, clarifier_count_per_turn: finalResult?.ui?.needsClarification === true ? 1 : 0, loop_retry_count: Math.max(0, Number(finalResult?.iterations || 0) - 1), false_success_detected: (!Array.isArray(finalResult?.actions) || finalResult.actions.length === 0) && /\b(applied|updated|changed)\b/i.test(finalMessage) && !/\b(no changes|not found|not applied|staged)\b/i.test(finalMessage), batch_state_transition: null, provider_model_latency_ms: durationMs, provider_model_error_rate: 0 });
      return res.json({ ...responsePayload, reasoningReport });
    } catch (e: any) {
      const message = String(e?.message || 'Assistant request failed');
      const configurationError = /api key|incorrect api key|invalid api key|not configured|unable to initialize requested provider|fetch failed|econnrefused|network|connection refused|unauthorized|forbidden/i.test(message);
      await deps.emitAssistantTelemetry('chat.failed', { provider: String(req.body?.provider || '').trim().toLowerCase() || null, error: message, durationMs: Date.now() - startedAt, provider_model_error_rate: 1 });
      return res.status(configurationError ? 400 : 500).json({ error: message });
    }
  }
}

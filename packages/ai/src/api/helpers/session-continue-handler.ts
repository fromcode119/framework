import { Request, Response } from 'express';
import type { ControllerDeps } from './controller-deps';

/** Handles the continueAssistantSession endpoint logic. */
export class SessionContinueHandler {
  static async handle(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    const startedAt = Date.now();
    let sessionProviderForTelemetry = '';
    try {
      const sessionId = deps.sessions.normalizeSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const session = await deps.sessions.load(sessionId);
      if (!session) return res.status(404).json({ error: 'Assistant session not found' });
      sessionProviderForTelemetry = String(session?.provider || '').trim().toLowerCase();

      const trackers = deps.getSessionTrackers(sessionId);
      if (session?.reasoningReport) {
        deps.recordReasoningStep(sessionId, 'Resumed session with restored context and reasoning', { previousReasoningSteps: session.reasoningReport.length }, {}, 0.95);
      }

      const message = String(req.body?.message || session?.lastCheckpoint?.resumePrompt || '').trim() || 'Continue planning from previous context. Run more steps and stage executable actions if safe.';
      const history = deps.sessions.normalizeHistory(session?.history);
      const sessionCheckpoint = deps.normalizeAssistantCheckpoint(req.body?.checkpoint || session?.lastCheckpoint);
      await deps.restoreSessionContext(sessionId, session);

      const resolvedAssistant = await (async () => {
        const originalBody = req.body;
        try {
          (req as any).body = { ...(req.body || {}), provider: String(req.body?.provider || session?.provider || '').trim() || undefined, config: { ...(session?.config && typeof session.config === 'object' ? session.config : {}), ...(req.body?.config && typeof req.body.config === 'object' ? req.body.config : {}) } };
          return await deps.resolveAssistantClientFromRequest(req);
        } finally { (req as any).body = originalBody; }
      })();

      const aiClient = resolvedAssistant.client;
      if (!aiClient || typeof aiClient.chat !== 'function') {
        return res.status(400).json({ error: 'AI Assistant integration is not configured. Set it in Settings > Integrations > AI Assistant.' });
      }

      const runtime = deps.createAssistantRuntime(req, aiClient);
      const taskComplexity = deps.complexityDetector.detectComplexity(message, { availableTools: Array.isArray(session?.tools) ? (session.tools as any[]).length : 5, hasHistory: true, agentMode: String(req.body?.agentMode || session?.agentMode || 'advanced') });
      const complexityAdjustedIterations = Math.min(Number(req.body?.maxIterations || 8), deps.complexityDetector.getRecommendedMaxIterations(taskComplexity));
      const contextForLLM = await deps.prepareContextForLLM(sessionId, history);
      deps.recordReasoningStep(sessionId, `Continuing session with message: ${message.substring(0, 100)}... [${taskComplexity.level} task]`, { resumeMessage: message, previousActions: session?.lastActions?.length || 0, complexity: taskComplexity.level }, {}, taskComplexity.confidence);

      const result = await runtime.chat({ message, provider: resolvedAssistant.provider, history: contextForLLM, agentMode: String(req.body?.agentMode || session?.agentMode || 'advanced'), maxIterations: complexityAdjustedIterations, maxDurationMs: Number(req.body?.maxDurationMs || 35000), allowedTools: Array.isArray(req.body?.tools) ? req.body.tools : Array.isArray(session?.tools) ? session.tools : [], skillId: String(req.body?.skillId || session?.skillId || 'general').trim().toLowerCase(), sessionId, continueFrom: true, checkpoint: sessionCheckpoint } as any);

      deps.recordReasoningStep(sessionId, `Continuation completed with ${Array.isArray(result?.actions) ? result.actions.length : 0} staged actions`, { agentMode: result?.agentMode }, { success: !!result?.message, actionCount: Array.isArray(result?.actions) ? result.actions.length : 0 }, 0.85);

      const nextHistory = deps.sessions.normalizeHistory([...history, { role: 'user', content: message }, { role: 'assistant', content: String(result?.message || '').trim() || 'No response generated.' }]);
      const reasoningReport = deps.getReasoningReport(sessionId);

      await deps.sessions.save(sessionId, { ...session, id: sessionId, title: String(session?.title || '').trim() || deps.sessions.summarizeTitle(nextHistory), updatedAt: Date.now(), provider: resolvedAssistant.provider, model: String(result?.model || '').trim() || String(session?.model || '').trim() || '', agentMode: String(req.body?.agentMode || session?.agentMode || 'advanced').trim(), skillId: String(req.body?.skillId || session?.skillId || 'general').trim().toLowerCase() || 'general', tools: Array.isArray(req.body?.tools) ? req.body.tools : Array.isArray(session?.tools) ? session.tools : [], config: { ...(session?.config || {}), ...(req.body?.config || {}) }, history: nextHistory, lastPlan: result?.plan || null, lastUi: result?.ui || null, lastActions: Array.isArray(result?.actions) ? result.actions : [], lastCheckpoint: result?.checkpoint || null, lastActionBatchState: String(result?.actionBatch?.state || session?.lastActionBatchState || '').trim() || null, reasoningReport });

      const reasoningStats = trackers.reasoning.generateReport();
      const resultMessage = String(result?.message || '');
      const pauseCountPerRequest = (resultMessage.match(/one more pass|continue planning|planning paused/gi) || []).length + (result?.ui?.canContinue === true ? 1 : 0);
      const durationMs = Date.now() - startedAt;
      await deps.emitAssistantTelemetry('chat.continue', { sessionId, provider: resolvedAssistant.provider, skillId: String(req.body?.skillId || session?.skillId || 'general').trim().toLowerCase() || 'general', iterations: Number(result?.iterations || 0) || 0, actions: Array.isArray(result?.actions) ? result.actions.length : 0, loopCapReached: result?.loopCapReached === true, durationMs, reasoningSteps: reasoningStats?.totalSteps || 0, averageConfidence: reasoningStats?.averageConfidence || 0, pause_count_per_request: pauseCountPerRequest, repeated_pause_copy_detected: pauseCountPerRequest > 1 || result?.ui?.loopRecoveryMode === 'best_effort', draft_fast_path_used: Array.isArray(result?.traces) ? result.traces.some((t: any) => /draft fast-path/i.test(String(t?.message || ''))) : false, clarification_vs_continue_rate: result?.ui?.needsClarification === true ? 1 : result?.ui?.canContinue === true ? 0 : null, clarifier_count_per_turn: result?.ui?.needsClarification === true ? 1 : 0, loop_retry_count: Math.max(0, Number(result?.iterations || 0) - 1), false_success_detected: (!Array.isArray(result?.actions) || result.actions.length === 0) && /\b(applied|updated|changed)\b/i.test(resultMessage) && !/\b(no changes|not found|not applied|staged)\b/i.test(resultMessage), batch_state_transition: null, provider_model_latency_ms: durationMs, provider_model_error_rate: 0 });

      return res.json({ ...result, provider: resolvedAssistant.provider, sessionId, reasoningReport });
    } catch (e: any) {
      await deps.emitAssistantTelemetry('chat.continue.failed', { provider: String(req.body?.provider || sessionProviderForTelemetry || '').trim().toLowerCase() || null, error: String(e?.message || 'Failed to continue assistant session'), durationMs: Date.now() - startedAt, provider_model_error_rate: 1 });
      return res.status(500).json({ error: e?.message || 'Failed to continue assistant session' });
    }
  }
}

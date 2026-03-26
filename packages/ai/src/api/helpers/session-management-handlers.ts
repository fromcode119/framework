import { Request, Response } from 'express';
import { TypeUtils } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core/client';
import type { ControllerDeps } from './controller-deps';

/** Handles session CRUD and reasoning report endpoints. */
export class SessionManagementHandlers {
  static async assistantSessions(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    try {
      const limit = Number(req.query?.limit || 60);
      const includeMessages = TypeUtils.parseBoolean(req.query?.includeMessages) === true;
      const sessions = await deps.sessions.list(limit);
      const summaries = sessions.map((entry) => {
        const summary = deps.sessions.sanitizeSummary(entry);
        if (!summary) return null;
        if (includeMessages) return { ...summary, messages: deps.sessions.normalizeHistory(entry?.history) };
        return summary;
      }).filter(Boolean);
      return res.json({ sessions: summaries });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to load assistant sessions' });
    }
  }

  static async assistantSession(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    try {
      const sessionId = deps.sessions.normalizeSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const session = await deps.sessions.load(sessionId);
      if (!session) return res.status(404).json({ error: 'Assistant session not found' });
      const summary = deps.sessions.sanitizeSummary(session);
      if (!summary) return res.status(404).json({ error: 'Assistant session not found' });
      return res.json({ session: { ...summary, messages: deps.sessions.normalizeHistory(session?.history), lastActions: Array.isArray(session?.lastActions) ? session.lastActions : [], lastExecution: session?.lastExecution || null } });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to load assistant session' });
    }
  }

  static async forkAssistantSession(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    try {
      const sessionId = deps.sessions.normalizeSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const session = await deps.sessions.load(sessionId);
      if (!session) return res.status(404).json({ error: 'Assistant session not found' });
      const sourceHistory = deps.sessions.normalizeHistory(session?.history);
      const fromIndexRaw = Number(req.body?.fromMessageIndex);
      const hasIndex = Number.isFinite(fromIndexRaw) && fromIndexRaw >= 0;
      const sourceSlice = hasIndex ? sourceHistory.slice(0, Math.floor(fromIndexRaw) + 1) : sourceHistory;
      const history = sourceSlice.length ? sourceSlice : sourceHistory;
      const nextSessionId = deps.sessions.normalizeSessionId(req.body?.sessionId) || `session-${Date.now()}`;
      const titleBase = String(session?.title || '').trim() || deps.sessions.summarizeTitle(history);
      const payload = { ...session, id: nextSessionId, title: `${titleBase} (fork)`, updatedAt: Date.now(), history };
      await deps.sessions.save(nextSessionId, payload);
      const summary = deps.sessions.sanitizeSummary(payload);
      return res.status(201).json({ session: { ...summary, messages: history, lastActions: Array.isArray(payload?.lastActions) ? payload.lastActions : [] } });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to fork assistant session' });
    }
  }

  static async deleteAssistantSession(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    try {
      const sessionId = deps.sessions.normalizeSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const key = deps.sessions.sessionMetaKey(sessionId);
      await deps.db.delete(SystemConstants.TABLE.META, { key });
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to delete assistant session' });
    }
  }

  static async assistantReasoningReport(req: Request, res: Response, deps: ControllerDeps): Promise<Response> {
    const startedAt = Date.now();
    try {
      const sessionId = deps.sessions.normalizeSessionId(req.params?.id);
      if (!sessionId) return res.status(400).json({ error: 'session id is required' });
      const session = await deps.sessions.load(sessionId);
      if (!session) return res.status(404).json({ error: 'Assistant session not found' });
      const trackers = deps.activeSessions.get(sessionId);
      const currentReport = trackers ? trackers.reasoning.generateReasoningReport() : null;
      const storedReport = session?.reasoningReport || null;
      const report = currentReport || storedReport;
      if (!report) {
        return res.status(404).json({ error: 'No reasoning report available for this session', hint: 'Reasoning data is only available for active or recently completed sessions' });
      }
      await deps.emitAssistantTelemetry('session.reasoning.report', { sessionId, durationMs: Date.now() - startedAt });
      return res.json({ sessionId, title: session?.title || 'Untitled session', report, metadata: { createdAt: session?.createdAt || null, updatedAt: session?.updatedAt || Date.now(), agentMode: session?.agentMode || 'advanced', skillId: session?.skillId || 'general' } });
    } catch (e: any) {
      await deps.emitAssistantTelemetry('session.reasoning.report.failed', { error: String(e?.message || 'Failed to get reasoning report'), durationMs: Date.now() - startedAt });
      return res.status(500).json({ error: e?.message || 'Failed to get reasoning report' });
    }
  }
}

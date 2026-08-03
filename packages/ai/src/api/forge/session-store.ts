import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@fromcode119/core/client';
import type { IAssistantHistoryEntry } from '@ai/api/forge/interfaces/assistant-history-entry.interface';

export class AssistantSessionStore {
  constructor(
    private db: IDatabaseManager,
    private keyPrefix: string,
    private group: string,
  ) {}

  normalizeSessionId(value: any): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 96);
  }

  sessionMetaKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  normalizeHistory(input: any): IAssistantHistoryEntry[] {
    const source = Array.isArray(input) ? input : [];

    return source
      .slice(-24)
      .map((entry: any) => {
        const role = String(entry?.role || 'user').trim().toLowerCase();
        const content = String(entry?.content || '').trim();
        return {
          role: AssistantRole.resolve(role),
          content,
        };
      })
      .filter((entry) => !!entry.content);
  }

  summarizeTitle(history: IAssistantHistoryEntry[], fallback: string = 'Untitled session'): string {
    const firstUser = history.find((entry) => entry.role === AssistantRole.USER && String(entry.content || '').trim());
    const text = String(firstUser?.content || '').replace(/\s+/g, ' ').trim();
    if (!text) return fallback;
    return text.length > 80 ? `${text.slice(0, 79)}...` : text;
  }

  sanitizeSummary(raw: any): any | null {
    if (!raw || typeof raw !== 'object') return null;
    const id = this.normalizeSessionId(raw.id || '');
    if (!id) return null;
    const history = this.normalizeHistory(raw.history);
    return {
      id,
      title: String(raw.title || '').trim() || this.summarizeTitle(history),
      updatedAt: Number(raw.updatedAt || Date.now()) || Date.now(),
      provider: String(raw.provider || '').trim().toLowerCase() || 'openai',
      model: String(raw.model || '').trim(),
      skillId: String(raw.skillId || 'general').trim().toLowerCase() || 'general',
      chatMode:
        String(raw.agentMode || '').trim().toLowerCase() === 'advanced'
          ? 'plan'
          : 'auto',
      sandboxMode: raw.sandboxMode !== false,
      messageCount: history.length,
      lastPlan: raw.lastPlan || null,
      lastUi: raw.lastUi || null,
      lastCheckpoint: raw.lastCheckpoint || null,
      lastActionsCount: Array.isArray(raw.lastActions) ? raw.lastActions.length : 0,
    };
  }

  async load(sessionId: string): Promise<any | null> {
    const normalized = this.normalizeSessionId(sessionId);
    if (!normalized) return null;
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: this.sessionMetaKey(normalized) }).catch(() => null);
    if (!row?.value) return null;
    try {
      const parsed = JSON.parse(String(row.value || '{}'));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async save(sessionId: string, payload: any): Promise<void> {
    const normalized = this.normalizeSessionId(sessionId);
    if (!normalized) return;
    const key = this.sessionMetaKey(normalized);
    const value = JSON.stringify(payload || {});
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key }).catch(() => null);
    if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value, group: existing.group || this.group });
      return;
    }
    await this.db.insert(SystemConstants.TABLE.META, { key, value, group: this.group });
  }

  async list(limit: number = 60): Promise<any[]> {
    const rows = await this.db.find(SystemConstants.TABLE.META, {
      where: { group: this.group },
      limit: Math.max(1, Math.min(200, Number(limit) || 60)),
    }).catch(() => []);

    const output: any[] = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = String(row?.key || '').trim();
      if (!key.startsWith(this.keyPrefix)) continue;
      try {
        const parsed = JSON.parse(String(row?.value || '{}'));
        if (parsed && typeof parsed === 'object') {
          const normalizedId = this.normalizeSessionId(parsed.id || key.slice(this.keyPrefix.length));
          if (!normalizedId) continue;
          output.push({
            ...parsed,
            id: normalizedId,
          });
        }
      } catch {
        // ignore invalid rows
      }
    }

    output.sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
    return output.slice(0, Math.max(1, Math.min(200, Number(limit) || 60)));
  }

  async remove(sessionId: string): Promise<void> {
    const normalized = this.normalizeSessionId(sessionId);
    if (!normalized) return;
    await this.db.delete(SystemConstants.TABLE.META, { key: this.sessionMetaKey(normalized) });
  }
}

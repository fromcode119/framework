import type { AssistantMessage } from '../../types.interfaces';
import type { AssistantCollectionContext, AssistantPluginContext, AssistantThemeContext, AssistantToolSummary } from '../types';
import { AssistantConstants } from '../constants';
import { ReplaceContentHelpers } from './replace-content-helpers';

/** Message building helpers extracted from AdminAssistantRuntime. */
export class ReplyMessageBuilders {
  static buildGreetingReply(): string {
    return 'Hey. We can chat, brainstorm, or ship a concrete change. Tell me what you want, and I will run with it.';
  }

  static buildCapabilityOverviewMessage(
    collections: AssistantCollectionContext[], plugins: AssistantPluginContext[],
    themes: AssistantThemeContext[], tools: AssistantToolSummary[],
  ): string {
    const writableTools = (tools || []).filter((t) => !t?.readOnly).map((t) => String(t?.tool || '').trim()).filter(Boolean);
    const readTools = (tools || []).filter((t) => !!t?.readOnly).map((t) => String(t?.tool || '').trim()).filter(Boolean);
    return [
      'I can inspect, draft, and stage content/settings changes.',
      `Current scope: ${Array.isArray(collections) ? collections.length : 0} collections, ${Array.isArray(plugins) ? plugins.length : 0} plugins, ${Array.isArray(themes) ? themes.length : 0} themes.`,
      `Tools: ${writableTools.length} write-capable, ${readTools.length} read/search.`,
      '',
      'If you want a change, just say it naturally (example: `Change homepage hero headline to "Better Websites"`).',
      'I stage first, preview next, apply only with your approval.',
    ].join('\n');
  }

  static buildStrategicAdviceFallbackMessage(
    collections: AssistantCollectionContext[], plugins: AssistantPluginContext[],
    themes: AssistantThemeContext[], tools: AssistantToolSummary[],
  ): string {
    const writeCount = (tools || []).filter((t) => !t?.readOnly).length;
    const readCount = (tools || []).filter((t) => !!t?.readOnly).length;
    return [
      'Focused efficiency plan:',
      '1. Ask for explicit targets up front: collection + id/slug + field path.',
      '2. Keep two passes: discovery first, staged writes second.',
      '3. Use batch preview first, then apply only validated actions.',
      '4. Route analysis requests to read-only mode and edits to writable mode.',
      '',
      `Current workspace scope: ${(collections || []).length} collections, ${(plugins || []).length} plugins, ${(themes || []).length} themes (${writeCount} write tools / ${readCount} read tools).`,
      'If you want, I can turn this into an executable implementation plan now.',
    ].join('\n');
  }

  static buildClarificationRequest(
    intent: 'homepage_draft' | 'general', candidateCollections: string[],
  ): { question: string; missingInputs: string[]; resumePrompt: string } {
    const collectionHint = candidateCollections.length
      ? ` Candidate collections: ${candidateCollections.slice(0, 3).join(', ')}.` : '';
    if (intent === 'homepage_draft') {
      return {
        question: `Which collection should store this homepage draft? Reply with collection slug.${collectionHint} If you want to update an existing page instead of creating a draft record, also include record id/slug.`,
        missingInputs: ['collection slug'],
        resumePrompt: 'Continue planning using the user-provided collection slug. Create a new homepage draft record unless the user explicitly provides record id/slug for update.',
      };
    }
    return {
      question: `Need one detail to finish staging: share collection + record id/slug + field path + new value.${collectionHint}`,
      missingInputs: ['collection slug', 'record id or slug', 'field path', 'new value'],
      resumePrompt: 'Continue planning with the user-provided collection, record id/slug, field path, and new value. Stage executable actions.',
    };
  }

  static isGenericPauseCopy(message: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text) return false;
    return /one more pass|continue planning|planning paused|finish this plan safely/.test(text);
  }

  static isReplaceFollowupIntent(prompt: string): boolean {
    const source = String(prompt || '').trim().toLowerCase();
    if (!source) return false;
    if (/https?:\/\/\S+/i.test(source)) return true;
    if (/^(ok|okay|yes|yep|yeah|do it|apply|go ahead|change it|update it|its here|it's here)\b/.test(source)) return true;
    const compact = source.replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
    const words = compact ? compact.split(' ') : [];
    if (words.length <= 6 && /(ok|yes|apply|go|change|update|here|it)/.test(compact)) return true;
    return false;
  }

  static deriveReplaceContinuation(
    message: string, history: AssistantMessage[],
  ): { instruction: { from: string; to: string }; composedPrompt: string } | null {
    if (!ReplyMessageBuilders.isReplaceFollowupIntent(message)) return null;
    const userHistory = (Array.isArray(history) ? history : []).filter((e) => e?.role === 'user');
    if (!userHistory.length) return null;
    let latestReplacePrompt = '';
    let latestUrlPrompt = '';
    for (let i = userHistory.length - 1; i >= 0; i -= 1) {
      const content = String(userHistory[i]?.content || '').trim();
      if (!content) continue;
      if (!latestUrlPrompt && /https?:\/\/\S+/i.test(content)) latestUrlPrompt = content;
      if (!latestReplacePrompt) {
        const parsed = ReplaceContentHelpers.parseReplaceInstruction(content);
        if (parsed) { latestReplacePrompt = content; break; }
      }
    }
    if (!latestReplacePrompt) return null;
    const instruction = ReplaceContentHelpers.parseReplaceInstruction(latestReplacePrompt);
    if (!instruction) return null;
    const parts = [latestReplacePrompt];
    if (latestUrlPrompt && latestUrlPrompt !== latestReplacePrompt) parts.push(latestUrlPrompt);
    parts.push(message);
    return { instruction, composedPrompt: parts.join('\n') };
  }

  static countRecentReplacementPauseMessages(history: AssistantMessage[]): number {
    return (Array.isArray(history) ? history : [])
      .filter((e) => e?.role === 'assistant')
      .slice(-8)
      .filter((e) => ReplyMessageBuilders.isGenericPauseCopy(String(e?.content || '')))
      .length;
  }

  static buildToolResultsFallbackMessage(
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>,
    currentMessage: string,
    formatToolLabel: (tool: string) => string,
  ): string {
    const safeResults = Array.isArray(toolResults) ? toolResults : [];
    if (!safeResults.length) return currentMessage || 'No additional results were returned.';
    const lines: string[] = ["Here's what I found:"];
    let foundMatches = false;
    const summaryByTool = new Map<string, { matches: number; records: number; failed: number; errors: string[]; samples: string[] }>();
    const seenSampleLines = new Set<string>();
    for (const item of safeResults) {
      const tool = String(item?.tool || 'tool').trim() || 'tool';
      const current = summaryByTool.get(tool) || { matches: 0, records: 0, failed: 0, errors: [], samples: [] };
      const callResult = item?.result || {};
      if (!callResult?.ok) {
        current.failed += 1;
        const errorText = String(callResult?.error || 'unknown error').trim();
        if (errorText && !current.errors.includes(errorText)) current.errors.push(errorText);
        summaryByTool.set(tool, current);
        continue;
      }
      const output = callResult?.output && typeof callResult.output === 'object' ? callResult.output : {};
      const matches = Array.isArray((output as any).matches) ? (output as any).matches : [];
      const totalMatches = Number((output as any).totalMatches ?? matches.length ?? 0);
      if (Number.isFinite(totalMatches) && totalMatches > current.matches) current.matches = totalMatches;
      if (Array.isArray((output as any).docs)) {
        const totalDocs = Number((output as any).totalDocs ?? (output as any).docs.length ?? 0);
        if (Number.isFinite(totalDocs) && totalDocs > current.records) current.records = totalDocs;
      }
      for (const match of matches.slice(0, 4)) {
        if (!match || typeof match !== 'object') continue;
        const collectionSlug = String((match as any).collectionSlug || '').trim();
        const slug = String((match as any).slug || '').trim();
        const path = String((match as any).path || (match as any).field || '').trim();
        const value = String((match as any).value || '').trim();
        const label = collectionSlug || slug || 'record';
        let line = '';
        if (path && value) line = `${label}.${path}: "${value}"`;
        else if (path) line = `${label}.${path}`;
        else if (value) line = `${label}: "${value}"`;
        if (line && !seenSampleLines.has(line)) { seenSampleLines.add(line); current.samples.push(line); }
      }
      summaryByTool.set(tool, current);
    }
    for (const [tool, summary] of summaryByTool.entries()) {
      const label = formatToolLabel(tool);
      if (summary.matches > 0) {
        foundMatches = true;
        lines.push(`- **${label}**: ${summary.matches} match${summary.matches === 1 ? '' : 'es'} found.`);
      } else if (summary.failed > 0) {
        if (foundMatches) continue;
        lines.push(`- **${label}**: failed (${summary.errors.join(' | ') || 'unknown error'}).`);
      } else if (summary.records > 0) {
        lines.push(`- **${label}**: ${summary.records} records returned.`);
      } else {
        if (foundMatches) continue;
        lines.push(`- **${label}**: no matches.`);
      }
    }
    const sampleLines = Array.from(summaryByTool.values()).flatMap((s) => s.samples).slice(0, 5);
    for (const line of sampleLines) lines.push(`  ${line}`);
    lines.push(foundMatches
      ? 'I can now stage exact update actions for preview and approval.'
      : 'No matches found yet. I can broaden the query or include additional collections/plugins/themes.');
    return lines.join('\n');
  }
}

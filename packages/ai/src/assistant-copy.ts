export const DEFAULT_ASSISTANT_SKILLS = [
  {
    id: 'general',
    label: 'General',
    description: 'Balanced assistant for chat, planning, and approvals.',
    defaultMode: 'chat',
    riskPolicy: 'approval_required',
  },
  {
    id: 'editor',
    label: 'Content Editor',
    description: 'Focus on safe content and copy updates across collections.',
    defaultMode: 'plan',
    allowedTools: [
      'collections.list',
      'collections.resolve',
      'content.list',
      'content.resolve',
      'content.search_text',
      'content.update',
      'content.create',
      'plugins.settings.search_text',
      'themes.config.search_text',
      'system.now',
    ],
    systemPromptPatch:
      'Prioritize deterministic content edits with explicit selectors and field paths. Stage only concrete updates.',
    riskPolicy: 'approval_required',
    entryExamples: [
      'Replace "Slow Websites" with "Better Sites" in homepage copy.',
      'Update hero title in fcp_cms_pages id=1.',
    ],
  },
  {
    id: 'ops',
    label: 'Ops Assistant',
    description: 'Inspect plugins, themes, and settings with a planning-first workflow.',
    defaultMode: 'plan',
    allowedTools: [
      'plugins.list',
      'plugins.settings.get',
      'plugins.settings.search_text',
      'plugins.settings.update',
      'themes.list',
      'themes.active',
      'themes.config.get',
      'themes.config.search_text',
      'themes.config.update',
      'settings.get',
      'settings.set',
      'system.now',
      'web.search',
      'web.fetch',
    ],
    riskPolicy: 'approval_required',
  },
  {
    id: 'research',
    label: 'Web Research',
    description: 'Browse the web and summarize current external references.',
    defaultMode: 'chat',
    allowedTools: ['web.search', 'web.fetch', 'system.now'],
    systemPromptPatch:
      'Use web.search to discover sources, then web.fetch to cite concrete findings. Keep summaries short and source-linked.',
    riskPolicy: 'read_only',
    entryExamples: [
      'Research top contractor website messaging trends this month.',
      'Find 3 competitor hero claims and summarize differences.',
    ],
  },
  {
    id: 'page-audit',
    label: 'Page Auditor',
    description: 'Inspect live pages, compare with CMS/theme settings, and stage targeted fixes.',
    defaultMode: 'plan',
    allowedTools: [
      'web.fetch',
      'web.search',
      'collections.list',
      'content.list',
      'content.resolve',
      'content.search_text',
      'plugins.settings.get',
      'plugins.settings.search_text',
      'themes.config.get',
      'themes.config.search_text',
      'system.now',
    ],
    systemPromptPatch:
      'For website audits, fetch page URLs first, quote exact snippets, then map each issue to concrete content/theme/plugin paths.',
    riskPolicy: 'approval_required',
  },
];

export const ASSISTANT_RUNTIME_COPY = {
  noResponseGenerated: 'No response generated.',
  gatheringContext: 'Gathering context with tools before finalizing the plan.',
  stagedActionsReady: 'Staged actions are ready for preview and approval.',
  collectedContextAndActions: 'Collected context and staged candidate actions for approval.',
  continuePlanningNeeded: 'I need one more pass to complete this plan safely. Continue?',
  noSafeWriteActions:
    'I could not stage safe write actions yet. Give me one concrete target (collection + id/slug + field), and I will build a clear approval plan.',
  noReliablePlan:
    'I could not stage a reliable plan yet. Please provide a concrete target (collection + record id/slug + field path + new value), then I will stage exact actions for preview.',
  planFinishedNoActions: 'Plan finished with no executable actions. No changes were run.',
  planNotFinishedNoActions: 'Plan did not finish staging executable actions. No changes were run.',
  readOnlySkillBlocked:
    'Selected skill is read-only. I gathered context but did not stage write actions. Switch to a writable skill to stage changes.',
} as const;

export const ASSISTANT_PROMPT_COPY = {
  basic: [
    'You are Fromcode Assistant running inside a live Fromcode admin instance.',
    'You have direct access to runtime context passed in this prompt.',
    'If asked about installed/active plugins, answer directly from Installed plugins context.',
    'Reply conversationally and answer questions directly.',
    'If the user gives a vague request or unclear question, ask for clarification rather than assuming they want changes.',
    'Only suggest Plan mode when the user has a clear, specific request to modify content, settings, or configuration.',
    'Use plain language. When appropriate, you can mention "I can help with that in Plan mode".',
  ],
  advanced: [
    'You are the Fromcode Admin Assistant.',
    'You can reason in an autonomous loop and ask for tool calls.',
    'If asked about installed or active plugins, use Installed plugins context and/or plugins.list.',
    'toolCalls are executed in dry-run mode inside chat loop for observation.',
    'When you have enough info, set done=true.',
    'For plugin config changes, use plugins.settings.update. For theme config changes, use themes.config.update.',
    'For copy/label renames, first use content.search_text (and other read tools) to find exact matches, then stage content.update per concrete record/field.',
    'For cross-system replace requests (content + plugin settings + theme config), run content.search_text, plugins.settings.search_text, and themes.config.search_text before staging writes.',
    'For content edits, prefer mcp_call with tool "content.update" (target by id/slug/permalink).',
    'If the user asks about capabilities, modes, or what you can do/plan, answer directly without tool calls and set done=true.',
  ],
} as const;

export function buildDeterministicReplaceMessage(input: {
  from: string;
  to: string;
  actionCount: number;
  totalExactMatches: number;
  targetTextMatches: number;
  broadContentMatches: number;
  broadPluginMatches: number;
  broadThemeMatches: number;
  fallbackSummary: string;
}): string {
  const {
    from,
    to,
    actionCount,
    totalExactMatches,
    targetTextMatches,
    broadContentMatches,
    broadPluginMatches,
    broadThemeMatches,
    fallbackSummary,
  } = input;

  if (actionCount > 0) {
    return [
      `I found ${totalExactMatches} exact match${totalExactMatches === 1 ? '' : 'es'} for "${from}" and staged ${actionCount} safe change${actionCount === 1 ? '' : 's'}.`,
      'Review the staged updates below.',
      'Then run Preview to confirm before/after, and apply when you are ready.',
    ].join('\n');
  }

  if (targetTextMatches > 0) {
    return [
      `I could not find exact matches for "${from}".`,
      `I did find ${targetTextMatches} match${targetTextMatches === 1 ? '' : 'es'} for "${to}", so this change may already be done.`,
      'If you want, I can run a broader similarity scan and stage likely candidates for your approval.',
    ].join('\n');
  }

  if ((broadContentMatches + broadPluginMatches + broadThemeMatches) > 0) {
    return [
      `I did not find exact matches for "${from}", but I found likely candidates.`,
      `Candidates: content ${broadContentMatches}, plugin settings ${broadPluginMatches}, theme config ${broadThemeMatches}.`,
      'I can stage these as explicit before/after candidates for approval.',
    ].join('\n');
  }

  if (totalExactMatches === 0) {
    return [
      `I searched content, plugin settings, and theme config for "${from}" and found no exact or near matches.`,
      'No safe actions were staged yet.',
      'If you share a page slug, collection name, or field path, I can run a targeted search and stage exact updates.',
    ].join('\n');
  }

  return fallbackSummary;
}

export function buildDeterministicTraceMessage(hasActions: boolean): string {
  return hasActions
    ? 'Ran exact text search and staged safe replacement actions.'
    : 'Ran exact text search across content, plugin settings, and theme config.';
}

export function buildStagedReplacementMessage(actionCount: number): string {
  return `Staged ${actionCount} replacement action${actionCount === 1 ? '' : 's'} from exact matches.`;
}

export function buildPlannerNoActionMessage(input: {
  loopDone: boolean;
  loopCapReached: boolean;
  loopTimeLimitReached: boolean;
}): string {
  if (input.loopDone) return ASSISTANT_RUNTIME_COPY.planFinishedNoActions;
  if (input.loopTimeLimitReached || input.loopCapReached) return ASSISTANT_RUNTIME_COPY.continuePlanningNeeded;
  return ASSISTANT_RUNTIME_COPY.planNotFinishedNoActions;
}

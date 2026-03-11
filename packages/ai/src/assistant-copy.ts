export class AssistantCopyUtils {
  static readonly DEFAULT_SKILLS = [
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
      'plugins.files.search_text',
      'plugins.files.replace_text',
      'themes.config.search_text',
      'themes.files.search_text',
      'themes.files.replace_text',
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
      'plugins.files.search_text',
      'plugins.files.replace_text',
      'themes.list',
      'themes.active',
      'themes.config.get',
      'themes.config.search_text',
      'themes.config.update',
      'themes.files.search_text',
      'themes.files.replace_text',
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
      'plugins.files.search_text',
      'themes.config.get',
      'themes.config.search_text',
      'themes.files.search_text',
      'system.now',
    ],
    systemPromptPatch:
      'For website audits, fetch page URLs first, quote exact snippets, then map each issue to concrete content/theme/plugin paths.',
    riskPolicy: 'approval_required',
  },
  ];

  static readonly RUNTIME_COPY = {
    noResponseGenerated: 'No response generated.',
    gatheringContext: 'Scanning context and staging concrete next actions.',
    stagedActionsReady: 'Changes are ready for review.',
    collectedContextAndActions: 'I gathered context and prepared changes for review.',
    continuePlanningNeeded: 'Need one detail to continue safely.',
    noSafeWriteActions:
      'I could not prepare safe write actions yet. Share one missing target detail and I will continue.',
    noReliablePlan:
      'I could not prepare a reliable plan yet. Share one missing target detail and I will continue.',
    planFinishedNoActions: 'Plan finished with no executable actions. No changes were run.',
    planNotFinishedNoActions: 'Plan did not finish staging executable actions. No changes were run.',
    readOnlySkillBlocked:
      'Selected skill is read-only. I gathered context but did not stage write actions. Switch to a writable skill to stage changes.',
    clarificationNeeded: 'Need one detail to continue.',
    bestEffortDraftReady: "Here's a draft now; confirm target to apply.",
  } as const;

  static readonly VIBE_SECTION = [
    'You have opinions. Commit to a take when evidence is strong; do not hide behind "it depends" unless uncertainty is real.',
    'Avoid corporate tone. If it sounds like handbook language, rewrite it.',
    "Never open with Great question, I'd be happy to help, or Absolutely. Just answer.",
    'Brevity is mandatory. If one sentence solves it, use one sentence.',
    'Natural humor is allowed when it helps clarity. Do not force jokes.',
    "Call things out when the user is about to do something dumb. Be direct, calm, and not cruel.",
    'Swearing is allowed when it lands. Keep it rare and never performative.',
    'If the request is ambiguous, CliUtils.ask one focused clarifying question before staging risky writes.',
    "Be the assistant you'd actually want to talk to at 2am. Not a corporate drone. Not a sycophant. Just... good.",
  ] as const;

  static readonly PROMPT_COPY = {
    basic: [
      'You are Fromcode Assistant running inside a live Fromcode admin instance.',
      'You have direct access to runtime context passed in this prompt.',
      'Answer directly and use plain language.',
      'If CliUtils.asked about installed/active plugins, answer directly from Installed plugins context.',
      'Ask one clarifying question if the request is vague instead of guessing.',
      'Only suggest Plan mode for specific change requests.',
    ],
    advanced: [
      'You are the Fromcode Admin Assistant.',
      'You can reason in an autonomous loop and CliUtils.ask for tool calls.',
      'If CliUtils.asked about installed or active plugins, use Installed plugins context and/or plugins.list.',
      'toolCalls are executed in dry-run mode inside chat loop for observation.',
      'When you have enough info, set done=true.',
      'For plugin config changes, use plugins.settings.update. For theme config changes, use themes.config.update.',
      'For copy/label renames, first use content.search_text (and other read tools) to find exact matches, then stage content.update per concrete record/field.',
      'For cross-system replace requests (content + plugin settings + theme config + plugin/theme files), run content.search_text, plugins.settings.search_text, plugins.files.search_text, themes.config.search_text, and themes.files.search_text before staging writes.',
      'Prefer managed updates first (content.update, plugins.settings.update, themes.config.update). Use file replace tools only when no managed target exists or when the user explicitly CliUtils.asks for file/code changes.',
      'For content edits, prefer mcp_call with tool "content.update" (target by id/slug/permalink).',
      'If the user CliUtils.asks about capabilities, modes, or what you can do/plan, answer directly without tool calls and set done=true.',
    ],
  } as const;
  static buildDeterministicReplaceMessage(input: {
    from: string;
    to: string;
    actionCount: number;
    totalExactMatches: number;
    targetTextMatches: number;
    broadContentMatches: number;
    broadPluginMatches: number;
    broadThemeMatches: number;
    fallbackSummary: string;
    blockedSearchTools?: string[];
    fileSearchTruncated?: boolean;
  }): string {
    const {
      from, to, actionCount, totalExactMatches, targetTextMatches,
      broadContentMatches, broadPluginMatches, broadThemeMatches,
      fallbackSummary, blockedSearchTools = [], fileSearchTruncated = false,
    } = input;
    const blockedLabel = blockedSearchTools.length > 0
      ? blockedSearchTools.map((tool) => `"${tool}"`).join(', ')
      : '';
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
      if (blockedSearchTools.length > 0) {
        return [
          `I could not run ${blockedLabel} in this skill/run, so this search is incomplete.`,
          `No exact matches for "${from}" were found in the tools I could access.`,
          'Switch to a skill with those tools (or enable them) and I will stage exact updates in one pass.',
        ].join('\n');
      }
      if (fileSearchTruncated) {
        return [
          `I found no exact matches for "${from}" yet, but file scanning hit its limit.`,
          'Share a plugin/theme slug to narrow the scan, and I will stage exact updates.',
        ].join('\n');
      }
      return [
        `I searched content, plugin settings, and theme config for "${from}" and found no exact or near matches.`,
        `I also checked plugin and theme source files for hardcoded values.`,
        'No safe actions were staged yet.',
        'If you share a page slug, collection name, or field path, I can run a targeted search and stage exact updates.',
      ].join('\n');
    }
    return fallbackSummary;
  }

  static buildDeterministicTraceMessage(hasActions: boolean): string {
    return hasActions
      ? 'Ran exact text search and staged safe replacement actions.'
      : 'Ran exact text search across content, plugin settings, theme config, and plugin/theme source files.';
  }

  static buildStagedReplacementMessage(actionCount: number): string {
    return `Staged ${actionCount} replacement action${actionCount === 1 ? '' : 's'} from exact matches.`;
  }

  static buildPlannerNoActionMessage(input: {
    loopDone: boolean;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
  }): string {
    if (input.loopDone) return AssistantCopyUtils.RUNTIME_COPY.planFinishedNoActions;
    if (input.loopTimeLimitReached || input.loopCapReached) return AssistantCopyUtils.RUNTIME_COPY.noSafeWriteActions;
    return AssistantCopyUtils.RUNTIME_COPY.planNotFinishedNoActions;
  }
}
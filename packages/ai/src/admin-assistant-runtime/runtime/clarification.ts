export class ClarificationBuilder {
  static buildClarificationForDraft(candidateCollections: string[]): {
    question: string;
    missingInputs: string[];
    resumePrompt: string;
  } {
    const hint = candidateCollections.length
      ? ` Candidate collections: ${candidateCollections.slice(0, 4).join(', ')}.`
      : '';
    return {
      question: `Need one detail to finish staging: which collection should store the homepage draft? Reply with collection slug.${hint}`,
      missingInputs: ['collection slug'],
      resumePrompt: 'Continue from user clarification and stage homepage draft actions.',
    };
  }

  static buildClarificationForReplace(input?: {
    from?: string;
    to?: string;
    urlHint?: string;
    foundTargetHints?: string[];
  }): { question: string; missingInputs: string[]; resumePrompt: string } {
    const from = String(input?.from || '').trim();
    const to = String(input?.to || '').trim();
    const urlHint = String(input?.urlHint || '').trim();
    const hintList = Array.isArray(input?.foundTargetHints)
      ? input!.foundTargetHints.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const topHints = hintList.slice(0, 3);

    if (from && to && urlHint) {
      return {
        question: `Need one detail to finish: apply "${from}" -> "${to}" to content records or to theme/plugin files for ${urlHint}?`,
        missingInputs: ['target scope (content or files)'],
        resumePrompt: 'Continue from user clarification and stage deterministic replacement actions for the selected scope.',
      };
    }

    if (from && to) {
      const hintText = topHints.length ? ` Likely targets found: ${topHints.join(', ')}.` : '';
      return {
        question: `Need one detail to finish: where should I apply "${from}" -> "${to}"? Share page URL, collection slug, or file path.${hintText}`,
        missingInputs: ['target location'],
        resumePrompt: 'Continue from user clarification and stage deterministic replacement actions for the selected target.',
      };
    }

    if (urlHint) {
      return {
        question: `Need one detail to finish: what exact text should change in ${urlHint}?`,
        missingInputs: ['text to replace', 'new text'],
        resumePrompt: 'Continue from user clarification and stage deterministic replacement actions with exact from/to values.',
      };
    }

    return {
      question: 'Need one detail to finish: tell me the exact change in one line, for example change "07000 000001" to "07000 000002".',
      missingInputs: ['text to replace', 'new text'],
      resumePrompt: 'Continue from user clarification and stage deterministic replacement actions with exact from/to values.',
    };
  }
}
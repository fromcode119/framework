
export class IntentClassifier {
  static isReadOnlyDiscoveryIntent(prompt: string): boolean {
      const text = String(prompt || '').trim().toLowerCase();
      if (!text) return false;
      const hasDiscoveryIntent =
        /\b(where|find|locate|search|which|show|list|tell me where)\b/.test(text) ||
        /\b(where is|where are|what contains|what has)\b/.test(text);
      if (!hasDiscoveryIntent) return false;
      const hasWriteIntent = /\b(update|replace|change|rename|set|delete|create|apply|fix|edit|modify)\b/.test(text);
      return !hasWriteIntent;

  }

  static isCapabilityOverviewIntent(prompt: string): boolean {
      const text = String(prompt || '').trim().toLowerCase();
      if (!text) return false;

      const asksCapabilities =
        /\bwhat can you (?:do|plan|change|help|handle)\b/.test(text) ||
        /\bwhat do you do\b/.test(text) ||
        /\bhow can you help\b/.test(text) ||
        /\bwhat are your capabilities\b/.test(text) ||
        /\bshow (?:me )?(?:your )?(?:capabilities|modes)\b/.test(text) ||
        /\bexplain (?:plan|agent|chat) mode\b/.test(text) ||
        /\bhow (?:does|do) (?:plan|agent|chat) mode\b/.test(text);

      if (!asksCapabilities) return false;

      const hasSpecificTarget =
        /["']([^"']+)["']/.test(text) ||
        /\b(in|on|for)\s+[a-z0-9_\-/]{3,}/.test(text) ||
        /\b(update|replace|change|rename|set|delete|create|apply|fix|edit|modify)\b/.test(text);

      return !hasSpecificTarget;

  }

  static isStrategicAdviceIntent(prompt: string): boolean {
      const text = String(prompt || '').trim().toLowerCase();
      if (!text) return false;

      const asksStrategy =
        /\b(efficien(?:cy|t)|effienci(?:y|es)?|optimi[sz]e|improvement|improve|recommend(?:ation|ations)?|suggest(?:ion|ions)?|roadmap|priorit(?:y|ies)|quick wins?)\b/.test(text) ||
        /\bwhat (?:should|can) we improve\b/.test(text) ||
        /\bhow can we improve\b/.test(text) ||
        /\bwhat can we do better\b/.test(text) ||
        /\bwhat (?:efficiency|effienciy) improvements\b/.test(text);

      if (!asksStrategy) return false;

      const explicitWriteTarget =
        /\b(collection|record|id|slug|field|path|setting|key)\s*[:=]/.test(text) ||
        /\b(update|replace|change|rename|set|delete|create|apply|modify)\b/.test(text) ||
        /["']([^"']+)["']/.test(text);

      return !explicitWriteTarget;

  }

  static isGreetingIntent(prompt: string): boolean {
      const text = String(prompt || '').trim().toLowerCase();
      if (!text) return false;
      return /^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))[\s!.?]*$/.test(text);

  }

  static isVagueChangeIntent(prompt: string): boolean {
      const text = String(prompt || '').trim().toLowerCase();
      if (!text) return false;
      const asksChange = /\b(change|update|edit|modify|fix|replace|set)\b/.test(text);
      if (!asksChange) return false;
      const looksVague =
        /\b(can you help|help me|one change|a change|some change|something)\b/.test(text) ||
        text.length < 90;
      const hasConcreteTarget =
        /["'][^"']+["']/.test(text) ||
        /\b(collection|record|id|slug|field|path|setting|key)\b/.test(text) ||
        /\bfrom\b.+\bto\b/.test(text) ||
        /\bhome(page)?\b/.test(text);
      return looksVague && !hasConcreteTarget;

  }

  static isExplicitFileModificationIntent(prompt: string): boolean {
      const text = String(prompt || '').trim().toLowerCase();
      if (!text) return false;
      return /\b(file|files|code|source|hardcoded|hard coded|plugin file|theme file|in plugin|in theme)\b/.test(text);

  }

  static isHomepageDraftIntent(prompt: string): boolean {
      const text = String(prompt || '').trim().toLowerCase();
      if (!text) return false;
      const asksHomepage = /\b(homepage|home page|landing page)\b/.test(text);
      const asksDraft = /\b(draft|first version|write|create|generate|build)\b/.test(text);
      const hasSections = /\bhero\b/.test(text) && /\bcta\b/.test(text) && /\bfaq\b/.test(text);
      return (asksHomepage && (asksDraft || hasSections)) || (asksDraft && hasSections);

  }
}
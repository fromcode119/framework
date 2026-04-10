import { TextHelpers } from './helpers/text-helpers';

export class FactualQueryHelpers {
  static trimLeadingGreeting(message: string): string {
    return String(message || '')
      .trim()
      .replace(/^(?:hi|hey|hello|yo|sup|good\s+(?:morning|afternoon|evening))[\s,!.:-]+/i, '')
      .trim();
  }

  static looksLikeReadOnlyDataQuestion(message: string): boolean {
    const source = FactualQueryHelpers.trimLeadingGreeting(message) || String(message || '');
    const text = TextHelpers.normalize(source);
    const asksForMetric = /\b(how much|(?:how|now)\s+many|tell me|show me|summary|stats|stat|count|number|total|totals|report|overview|highest|lowest|largest|smallest|max(?:imum)?|min(?:imum)?|average)\b/.test(text);
    const namesMetricTarget = /\b(revenue|sales|earnings|income|profit|refunds?|transactions?|wallet|balance|orders?|metrics?|amount)\b/.test(text);
    const directMetricQuestion = /\b(what is|what's|tell me|show me)\s+(the\s+)?(revenue|sales|earnings|income|profit|refunds?|transactions?|wallet|balance|orders?|metrics?|amount)\b/.test(text);
    const periodOrOwnershipHint = /\b(this|last|today|yesterday|month|week|year|i have|my)\b/.test(text);
    return /\baccess my\b/.test(text)
      || FactualQueryHelpers.looksLikeEntityDetailQuestion(source)
      || directMetricQuestion
      || (asksForMetric && namesMetricTarget)
      || (namesMetricTarget && periodOrOwnershipHint);
  }

  static inferPeriod(message: string): string | undefined {
    const text = TextHelpers.normalize(FactualQueryHelpers.trimLeadingGreeting(message) || message);
    if (/\btoday\b/.test(text)) return 'today';
    if (/\byesterday\b/.test(text)) return 'yesterday';
    if (/\blast week\b/.test(text)) return 'last_week';
    if (/\bthis week\b/.test(text)) return 'this_week';
    if (/\blast month\b/.test(text)) return 'last_month';
    if (/\bthis month\b/.test(text)) return 'this_month';
    if (/\blast 7 days\b|\bpast 7 days\b/.test(text)) return 'last_7_days';
    if (/\blast 30 days\b|\bpast 30 days\b/.test(text)) return 'last_30_days';
    return /\b(revenue|sales|earnings|income|profit|refunds?|transactions?|wallet|balance|orders?|metrics?|amount)\b/.test(text)
      ? 'last_30_days'
      : undefined;
  }

  static buildToolInput(message: string): Record<string, unknown> {
    const period = FactualQueryHelpers.inferPeriod(message);
    return period ? { period } : {};
  }

  static looksLikeFactualFollowup(message: string): boolean {
    const text = TextHelpers.normalize(FactualQueryHelpers.trimLeadingGreeting(message) || message);
    if (!text) return false;
    if (FactualQueryHelpers.inferPeriod(text)) return true;
    return /\b(for|what about|and|total|revenue|sales|earnings|income|profit|refunds?|transactions?|wallet|balance|orders?|metrics?|amount|highest|lowest|max(?:imum)?|min(?:imum)?|average|count|number|how much|how many)\b/.test(text);
  }

  static hasExplicitMetricTarget(message: string): boolean {
    const text = TextHelpers.normalize(FactualQueryHelpers.trimLeadingGreeting(message) || message);
    return /\b(total|revenue|sales|earnings|income|profit|refunds?|wallet|balance|metrics?|amount|highest|lowest|max(?:imum)?|min(?:imum)?|average|count|number)\b/.test(text);
  }

  static looksLikeEntityDetailQuestion(message: string): boolean {
    const text = TextHelpers.normalize(FactualQueryHelpers.trimLeadingGreeting(message) || message);
    const namesEntity = /\b(order|orders|transaction|transactions|payment|payments|invoice|invoices|shipment|shipments|record|records|item|items|product|products|customer|customers)\b/.test(text);
    const asksForPosition = /\b(first|last|latest|earliest|oldest|newest|highest|lowest|biggest|smallest)\b/.test(text);
    const asksForFieldValue = /\b(what|which|who|when)\b/.test(text)
      && /\b(status|email|id|reference|provider|customer|name|title|color|colour|weight|shipping|address|phone|sku|tracking)\b/.test(text);
    return namesEntity && (asksForPosition || asksForFieldValue || /\b(what was|which was|who was|when was)\b/.test(text));
  }

  static formatRange(range: any): string {
    const label = String(range?.label || '').trim();
    const from = String(range?.from || '').trim();
    const to = String(range?.to || '').trim();
    if (label && from && to) {
      return `${label} (${from} to ${to})`;
    }
    if (label) {
      return label;
    }
    if (from && to) {
      return `${from} to ${to}`;
    }
    return '';
  }

  static collectPrimitiveEntries(
    value: unknown,
    prefix: string = '',
    depth: number = 0,
  ): Array<{ path: string; value: string | number | boolean }> {
    if (depth > 2 || !value || typeof value !== 'object') {
      return [];
    }

    const entries: Array<{ path: string; value: string | number | boolean }> = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
        entries.push({ path, value: child });
        continue;
      }
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        entries.push(...FactualQueryHelpers.collectPrimitiveEntries(child, path, depth + 1));
      }
    }
    return entries;
  }

  static scoreNumericEntry(path: string, message: string): number {
    const keyTokens = FactualQueryHelpers.tokenize(path);
    const queryTokens = FactualQueryHelpers.tokenize(message);
    const lowerPath = TextHelpers.normalize(path);
    const lowerMessage = TextHelpers.normalize(message);
    let score = 0;
    for (const token of queryTokens) {
      if (keyTokens.includes(token)) {
        score += 8;
      }
    }
    if (/\b(total|summary)\b/.test(lowerMessage) && /\b(total|summary)\b/.test(lowerPath)) {
      score += 4;
    }
    if (FactualQueryHelpers.isCountLikePath(path)) {
      score += /\b(how many|count|number)\b/.test(lowerMessage) ? 12 : 0;
    }
    if (/\btransactions?\b/.test(lowerMessage) && /\btransactioncount\b|transactioncount|transaction_count/i.test(path)) {
      score += 20;
    }
    if (FactualQueryHelpers.isSubCountLikePath(path) && !keyTokens.some((token) => queryTokens.includes(token))) {
      score -= 5;
    }
    if (/\b(how many|count|number)\b/.test(lowerMessage) && !FactualQueryHelpers.isCountLikePath(path)) {
      score -= 4;
    }
    if (/\b(how many|count|number|transactions?)\b/.test(lowerMessage) && /\bcount\b|count[a-z]/i.test(path)) {
      score += 10;
    }
    if (/\brevenue|sales|earnings|income|profit\b/.test(lowerMessage) && /\brevenue\b|revenue[a-z]/i.test(path)) {
      score += 10;
    }
    if (!/\bnet\b/.test(lowerMessage) && /\bnet\b|net[a-z]/i.test(path)) {
      score -= 1;
    }
    if (!/\brefund/.test(lowerMessage) && /\brefund\b|refund[a-z]/i.test(path)) {
      score -= 3;
    }
    return score;
  }

  static formatValue(path: string, value: number, currency?: string): string {
    const isCount = FactualQueryHelpers.isCountLikePath(path);
    if (!isCount && currency) {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 2,
        }).format(value);
      } catch {
        return `${currency} ${value.toFixed(2)}`;
      }
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  static humanizePath(path: string): string {
    const cleaned = String(path || '').split('.').slice(-1)[0];
    return cleaned
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  static humanizeToolName(toolName: string): string {
    return String(toolName || '')
      .split('.')
      .map((part) => part.replace(/[_-]+/g, ' '))
      .join(' ')
      .trim();
  }

  static tokenize(value: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'can', 'could', 'do', 'for', 'give', 'help', 'i', 'me', 'my',
      'of', 'please', 'show', 'tell', 'the', 'this', 'to', 'was', 'what', 'whats', 'with', 'you',
    ]);
    return String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stopWords.has(token));
  }

  static isCountLikePath(path: string): boolean {
    const normalized = TextHelpers.normalize(path)
      .replace(/[_.-]+/g, ' ');
    return /\b(count|number|totaldocs|total docs|qty|quantity|transaction count|transactioncount|order count|ordercount|record count|recordcount|entry count|entrycount|row count|rowcount|doc count|doccount|count by type|countbytype)\b/.test(normalized);
  }

  static isSubCountLikePath(path: string): boolean {
    return /countbytype|count_by_type|count by type/i.test(String(path || ''));
  }
}

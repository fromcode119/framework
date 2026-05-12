export class ApplicationDomainSettingsUtils {
  static collectAllowedDomains(args: {
    envAllowedDomains?: unknown;
    platformDomain?: unknown;
    siteUrl?: unknown;
    frontendUrl?: unknown;
    adminUrl?: unknown;
    apiUrl?: unknown;
    domainAliases?: unknown;
  }): string[] {
    return ApplicationDomainSettingsUtils.unique([
      ...ApplicationDomainSettingsUtils.parseDomainAliases(args.envAllowedDomains),
      ApplicationDomainSettingsUtils.normalizeHostname(args.platformDomain),
      ApplicationDomainSettingsUtils.normalizeHostname(args.siteUrl),
      ApplicationDomainSettingsUtils.normalizeHostname(args.frontendUrl),
      ApplicationDomainSettingsUtils.normalizeHostname(args.adminUrl),
      ApplicationDomainSettingsUtils.normalizeHostname(args.apiUrl),
      ...ApplicationDomainSettingsUtils.parseDomainAliases(args.domainAliases),
    ]);
  }

  static mergeDomainAliasesForPrimaryChange(args: {
    currentAliases?: unknown;
    previousValues?: unknown[];
    nextValues?: unknown[];
  }): string[] {
    const aliases = [
      ...ApplicationDomainSettingsUtils.parseDomainAliases(args.currentAliases),
    ];
    const nextHosts = new Set(
      ApplicationDomainSettingsUtils.unique(
        (args.nextValues || []).map((value) => ApplicationDomainSettingsUtils.normalizeHostname(value)),
      ),
    );

    for (const hostname of ApplicationDomainSettingsUtils.unique(
      (args.previousValues || []).map((value) => ApplicationDomainSettingsUtils.normalizeHostname(value)),
    )) {
      if (hostname && !nextHosts.has(hostname)) {
        aliases.push(hostname);
      }
    }

    return ApplicationDomainSettingsUtils.unique(aliases);
  }

  static parseDomainAliases(value: unknown): string[] {
    if (Array.isArray(value)) {
      return ApplicationDomainSettingsUtils.unique(
        value.map((item) => ApplicationDomainSettingsUtils.normalizeHostname(item)),
      );
    }

    const raw = String(value ?? '').trim();
    if (!raw) {
      return [];
    }

    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return ApplicationDomainSettingsUtils.unique(
            parsed.map((item) => ApplicationDomainSettingsUtils.normalizeHostname(item)),
          );
        }
      } catch {
        return [];
      }
    }

    return ApplicationDomainSettingsUtils.unique(
      raw.split(',').map((item) => ApplicationDomainSettingsUtils.normalizeHostname(item)),
    );
  }

  static normalizeHostname(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) {
      return '';
    }

    const normalizedUrl = ApplicationDomainSettingsUtils.tryParseUrl(raw);
    if (normalizedUrl) {
      return normalizedUrl.hostname.toLowerCase();
    }

    return raw
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
      .replace(/^\.+|\.+$/g, '')
      .trim();
  }

  private static tryParseUrl(value: string): URL | null {
    try {
      if (value.includes('://')) {
        return new URL(value);
      }

      if (value.includes('/') || value.includes(':')) {
        return new URL(`https://${value}`);
      }
    } catch {
      return null;
    }

    return null;
  }

  private static unique(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(normalized);
    }

    return result;
  }
}

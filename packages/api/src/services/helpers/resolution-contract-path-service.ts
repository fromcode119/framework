import type { ResolvedPluginDefaultPageContract } from '@fromcode119/core';

export class ResolutionContractPathService {
  static findMatchingPattern(contract: ResolvedPluginDefaultPageContract, inputPath: string): string | null {
    const patterns = [contract.effectiveSlug, ...(contract.effectiveAliases || [])]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    for (const pattern of patterns) {
      if (ResolutionContractPathService.matchesPattern(pattern, inputPath)) {
        return pattern;
      }
    }

    return null;
  }

  static hasPathParameters(pattern: string): boolean {
    return ResolutionContractPathService.normalizePath(pattern)
      .split('/')
      .filter(Boolean)
      .some((segment) => segment.startsWith(':'));
  }

  static extractPathParameters(pattern: string, inputPath: string): Record<string, string> {
    const patternSegments = ResolutionContractPathService.normalizePath(pattern).split('/').filter(Boolean);
    const inputSegments = ResolutionContractPathService.normalizePath(inputPath).split('/').filter(Boolean);
    if (patternSegments.length !== inputSegments.length) {
      return {};
    }

    const parameters: Record<string, string> = {};
    patternSegments.forEach((segment, index) => {
      if (segment.startsWith(':')) {
        parameters[segment.slice(1)] = inputSegments[index];
      }
    });

    return parameters;
  }

  private static matchesPattern(pattern: string, inputPath: string): boolean {
    const patternSegments = ResolutionContractPathService.normalizePath(pattern).split('/').filter(Boolean);
    const inputSegments = ResolutionContractPathService.normalizePath(inputPath).split('/').filter(Boolean);
    if (patternSegments.length !== inputSegments.length) {
      return false;
    }

    return patternSegments.every((segment, index) => {
      if (segment.startsWith(':')) {
        return inputSegments[index].length > 0;
      }
      return segment === inputSegments[index];
    });
  }

  private static normalizePath(value: string): string {
    const normalizedValue = String(value || '').trim().split('?')[0].split('#')[0].trim();
    if (!normalizedValue) {
      return '/';
    }

    const withSlash = normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
  }
}
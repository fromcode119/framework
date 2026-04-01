import { AdminApi } from '@/lib/api';

export class IntegrationsFieldOptionsService {
  buildFieldStateKey(providerId: string, providerKey: string, fieldName: string): string {
    return [providerId || 'new', providerKey || 'unknown', fieldName].join(':');
  }

  async loadOptions(
    field: {
      name: string;
      options?: Array<{ label: string; value: string }>;
      optionsEndpoint?: string;
    },
    context: {
      providerId?: string;
      providerKey?: string;
    }
  ): Promise<Array<{ label: string; value: string }>> {
    const staticOptions = this.normalizeOptions(field.options || []);
    if (!field.optionsEndpoint || !context.providerId) {
      return staticOptions;
    }

    const response = await AdminApi.get(this.buildOptionsUrl(field.optionsEndpoint, context), { noDedupe: true });
    const remoteOptions = this.extractOptions(response);
    return this.mergeOptions(remoteOptions, staticOptions);
  }

  ensureValueOption(
    options: Array<{ label: string; value: string }>,
    value: unknown
  ): Array<{ label: string; value: string }> {
    const normalizedValue = String(value ?? '').trim();
    if (!normalizedValue) {
      return options;
    }
    if (options.some((option) => option.value === normalizedValue)) {
      return options;
    }
    return [{ label: normalizedValue, value: normalizedValue }, ...options];
  }

  private buildOptionsUrl(
    endpoint: string,
    context: {
      providerId?: string;
      providerKey?: string;
    }
  ): string {
    const url = new URL(AdminApi.getURL(endpoint));
    if (context.providerId) {
      url.searchParams.set('providerId', context.providerId);
    }
    if (context.providerKey) {
      url.searchParams.set('providerKey', context.providerKey);
    }
    return url.toString();
  }

  private extractOptions(response: unknown): Array<{ label: string; value: string }> {
    const rawOptions = Array.isArray((response as any)?.options)
      ? (response as any).options
      : Array.isArray(response)
        ? response
        : [];
    return this.normalizeOptions(rawOptions);
  }

  private normalizeOptions(options: Array<{ label?: unknown; value?: unknown }>): Array<{ label: string; value: string }> {
    return options
      .map((option) => ({
        label: String(option?.label ?? '').trim(),
        value: String(option?.value ?? '').trim()
      }))
      .filter((option) => option.label && option.value);
  }

  private mergeOptions(
    primary: Array<{ label: string; value: string }>,
    secondary: Array<{ label: string; value: string }>
  ): Array<{ label: string; value: string }> {
    const merged: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();

    for (const option of [...primary, ...secondary]) {
      if (!option.value || seen.has(option.value)) {
        continue;
      }
      seen.add(option.value);
      merged.push(option);
    }

    return merged;
  }
}

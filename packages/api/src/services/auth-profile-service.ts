export class AuthProfileService {
  static parseStoredProfile(rawValue: unknown): Record<string, string> {
    if (!rawValue) {
      return {};
    }

    try {
      const parsedValue = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      const source = parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
        ? parsedValue as Record<string, unknown>
        : {};
      return AuthProfileService.extractScalarFields(source);
    } catch {
      return {};
    }
  }

  static sanitizeProfilePayload(payload: Record<string, any>): Record<string, string> {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};

    return AuthProfileService.extractScalarFields(source);
  }

  static extractUserNameFields(source: Record<string, string>): Record<string, string> {
    return {
      firstName: String(source.firstName || '').trim(),
      lastName: String(source.lastName || '').trim(),
    };
  }

  static stripUserNameFields(source: Record<string, string>): Record<string, string> {
    const profileFields: Record<string, string> = {};

    for (const [key, value] of Object.entries(source || {})) {
      if (AuthProfileService.isUserCoreField(key)) {
        continue;
      }

      profileFields[key] = value;
    }

    return profileFields;
  }

  private static extractScalarFields(source: Record<string, unknown>): Record<string, string> {
    const scalarFields: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = String(rawKey || '').trim();
      if (!AuthProfileService.isAllowedExtraFieldKey(key)) {
        continue;
      }

      if (rawValue === null || rawValue === undefined) {
        continue;
      }

      if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        scalarFields[key] = String(rawValue).trim();
      }
    }

    return scalarFields;
  }

  private static isAllowedExtraFieldKey(key: string): boolean {
    return /^[a-z][a-zA-Z0-9_]{1,63}$/.test(key);
  }

  private static isUserCoreField(key: string): boolean {
    return key === 'firstName' || key === 'lastName';
  }
}

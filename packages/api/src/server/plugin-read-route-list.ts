import { CoercionUtils } from '@fromcode119/core';

/**
 * The values of a list the way a plugin reads them: `?slugs=a,b` and `?slugs=a&slugs=b` are the same
 * list, separated by a comma, a semicolon or a line break, each trimmed, empty ones dropped, each once.
 */
export class PluginReadRouteList {
  static items(value: unknown): string[] {
    const raw = CoercionUtils.toString(value).trim();
    return raw ? Array.from(new Set(raw.split(/[,\n;]/g).map((item) => item.trim()).filter(Boolean))) : [];
  }
}

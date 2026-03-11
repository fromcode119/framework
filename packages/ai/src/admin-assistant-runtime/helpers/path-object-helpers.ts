import type { AssistantCollectionContext } from '../types';

/** Path traversal and object utility methods extracted from AdminAssistantRuntime. */
export class PathObjectHelpers {
  static parsePathSegments(path: string): Array<string | number> {
    const source = String(path || '').trim();
    if (!source) return [];
    const segments: Array<string | number> = [];
    const pattern = /([^[.\]]+)|\[(.*?)\]/g;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(source))) {
      const token = String(match[1] || match[2] || '').trim();
      if (!token) continue;
      segments.push(/^\d+$/.test(token) ? Number(token) : token);
    }
    return segments;
  }

  static normalizeConfigPathSegments(path: string): Array<string | number> {
    const segments = PathObjectHelpers.parsePathSegments(path);
    if (!segments.length) return [];
    const first = String(segments[0] ?? '').trim().toLowerCase();
    return first === 'config' ? segments.slice(1) : segments;
  }

  static getBySegments(source: any, segments: Array<string | number>): any {
    let cursor = source;
    for (const segment of segments) {
      if (cursor === null || cursor === undefined) return undefined;
      cursor = cursor[segment as any];
    }
    return cursor;
  }

  static setBySegments(target: any, segments: Array<string | number>, value: any): void {
    if (!target || typeof target !== 'object' || !segments.length) return;
    let cursor: any = target;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const next = segments[i + 1];
      if (cursor[segment as any] === undefined || cursor[segment as any] === null)
        cursor[segment as any] = typeof next === 'number' ? [] : {};
      cursor = cursor[segment as any];
    }
    cursor[segments[segments.length - 1] as any] = value;
  }

  static normalizePathKeyedObject(value: any): Record<string, any> {
    const source = value && typeof value === 'object' ? value : {};
    const normalized: Record<string, any> = {};
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const key = String(rawKey || '').trim();
      if (!key) continue;
      if (key.includes('.') || key.includes('[')) {
        const segments = PathObjectHelpers.parsePathSegments(key);
        if (segments.length) { PathObjectHelpers.setBySegments(normalized, segments, rawValue); continue; }
      }
      normalized[key] = rawValue;
    }
    return normalized;
  }

  static objectContainsText(value: any, needle: string): boolean {
    const text = String(needle || '').trim().toLowerCase();
    if (!text) return false;
    if (typeof value === 'string') return value.toLowerCase().includes(text);
    if (Array.isArray(value)) return value.some((e) => PathObjectHelpers.objectContainsText(e, text));
    if (value && typeof value === 'object')
      return Object.values(value).some((e) => PathObjectHelpers.objectContainsText(e, text));
    return false;
  }

  static deepClone<T>(value: T): T {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  static readPathValue(source: any, path: string): any {
    const safeSource = source && typeof source === 'object' ? source : {};
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) return undefined;
    const tokens = normalizedPath.replace(/\[(\d+)\]/g, '.$1').split('.').map((t) => t.trim()).filter(Boolean);
    let cursor: any = safeSource;
    for (const token of tokens) {
      if (cursor === null || cursor === undefined) return undefined;
      cursor = cursor[token];
    }
    return cursor;
  }

  static pathsLikelySame(left: string, right: string): boolean {
    const a = String(left || '').trim().toLowerCase();
    const b = String(right || '').trim().toLowerCase();
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.endsWith(`.${b}`) || b.endsWith(`.${a}`)) return true;
    return false;
  }

  static filterContentPayloadByCollectionFields(
    collection: AssistantCollectionContext,
    payload: Record<string, any>,
  ): Record<string, any> {
    const source = payload && typeof payload === 'object' ? payload : {};
    const fields = Array.isArray((collection as any)?.raw?.fields) ? (collection as any).raw.fields : [];
    const allowed = new Set(fields.map((field: any) => String(field?.name || '').trim()).filter(Boolean));
    if (!allowed.size) return source;
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(source)) {
      const k = String(key || '').trim();
      if (k && allowed.has(k)) filtered[k] = value;
    }
    return filtered;
  }
}

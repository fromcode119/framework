/**
 * Resolves a relationship field value to a plain string.
 *
 * Relationship fields can arrive in several shapes depending on query depth:
 *  - already a string / number  → returned as-is (trimmed)
 *  - a populated object         → slug > value > id > first string property
 *  - null / undefined           → empty string
 *
 * @example
 * resolveRelationValue('about-us')          // 'about-us'
 * resolveRelationValue({ slug: 'about-us' }) // 'about-us'
 * resolveRelationValue({ id: 42 })           // '42'
 */
export function resolveRelationValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const direct = String(obj.slug ?? obj.value ?? obj.id ?? '').trim();
    if (direct) return direct;
    const firstString = Object.values(obj).find(
      (v): v is string => typeof v === 'string' && v.trim() !== ''
    );
    return firstString?.trim() ?? '';
  }
  return '';
}

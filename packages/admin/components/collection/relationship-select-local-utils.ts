export class RelationshipSelectLocalUtils {
  static toScalar(input: unknown): string {
    if (input === null || input === undefined) return '';
    if (typeof input === 'string' || typeof input === 'number') return String(input);
    if (typeof input === 'object') {
      const objectInput = input as Record<string, unknown>;
      const fromObject = objectInput.id ?? objectInput._id ?? objectInput.value ?? objectInput.slug ?? '';
      return String(fromObject || '');
    }
    return String(input);
  }
}
export class RelationshipSelectLocalUtils {
  static readonly OPTION_KEY_DELIMITER = '::';

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

  static resolveRelationTarget(input: unknown): string {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return '';
    const objectInput = input as Record<string, unknown>;
    return String(
      objectInput.relationTo
      ?? objectInput.sourceCollection
      ?? objectInput.collection
      ?? objectInput.collectionSlug
      ?? ''
    ).trim();
  }

  static toOptionKey(input: unknown, relationTarget?: string): string {
    const scalar = RelationshipSelectLocalUtils.toScalar(input);
    const target = String(relationTarget || RelationshipSelectLocalUtils.resolveRelationTarget(input) || '').trim();
    if (!scalar) return '';
    if (!target) return scalar;
    return `${target}${RelationshipSelectLocalUtils.OPTION_KEY_DELIMITER}${scalar}`;
  }

  static parseOptionKey(input: unknown): { relationTo: string; scalar: string } {
    const raw = String(input || '').trim();
    if (!raw) return { relationTo: '', scalar: '' };
    const delimiterIndex = raw.indexOf(RelationshipSelectLocalUtils.OPTION_KEY_DELIMITER);
    if (delimiterIndex < 0) return { relationTo: '', scalar: raw };
    return {
      relationTo: raw.slice(0, delimiterIndex).trim(),
      scalar: raw.slice(delimiterIndex + RelationshipSelectLocalUtils.OPTION_KEY_DELIMITER.length).trim(),
    };
  }

  static buildTaggedValue(input: unknown, relationTarget: string): any {
    const scalar = RelationshipSelectLocalUtils.toScalar(input);
    if (!scalar) return input;
    return {
      id: scalar,
      relationTo: String(relationTarget || '').trim(),
    };
  }
}
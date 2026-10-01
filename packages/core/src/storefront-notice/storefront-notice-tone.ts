import { Enum } from '@fromcode119/react-class-components/lang';

/** How a storefront notice reads: a done thing, a neutral note, or something that did not work. */
export class StorefrontNoticeTone extends Enum {
  static readonly SUCCESS = new StorefrontNoticeTone('success');
  static readonly INFO = new StorefrontNoticeTone('info');
  static readonly ERROR = new StorefrontNoticeTone('error');

  private constructor(value: string) {
    super(value);
  }

  /** An unknown tone is a neutral note — never a success nobody claimed. */
  static of(value: unknown): StorefrontNoticeTone {
    if (value instanceof StorefrontNoticeTone) return value;
    return (StorefrontNoticeTone.fromValue(String(value ?? '').trim().toLowerCase()) as StorefrontNoticeTone | undefined) ?? StorefrontNoticeTone.INFO;
  }
}

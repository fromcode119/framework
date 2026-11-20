import type { KitExample } from '@/app/kit/kit-example';
import type { KitOption } from '@/app/kit/kit-option';

/** A component's page in the kit. */
export class KitDoc {
  declare slug: string;
  declare name: string;
  declare group: string;
  /** One or two sentences: what it is and when to reach for it. */
  declare intro: string;
  /** Where it is imported from. */
  declare from: string;
  declare examples: KitExample[];
  declare options: KitOption[];
}

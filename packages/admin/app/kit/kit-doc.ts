import type { ReactNode } from 'react';

/** One option a component takes: its name, what it accepts, what it is when left out, and what it does. */
export class KitOption {
  declare name: string;
  declare type: string;
  declare initial?: string;
  declare does: string;
}

/** One way of using a component: what it is for, the component itself, and how it is written. */
export class KitExample {
  declare title: string;
  declare text?: string;
  declare demo: ReactNode;
  declare code?: string;
  /** The demo fills the example's width instead of sitting in a padded row (a table, a card, a bar). */
  declare flush?: boolean;
}

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

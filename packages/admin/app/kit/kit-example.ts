import type { ReactNode } from 'react';

/** One way of using a component: what it is for, the component itself, and how it is written. */
export class KitExample {
  declare title: string;
  declare text?: string;
  declare demo: ReactNode;
  declare code?: string;
  /** The demo fills the example's width instead of sitting in a padded row (a table, a card, a bar). */
  declare flush?: boolean;
}

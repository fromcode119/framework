/** One option a component takes: its name, what it accepts, what it is when left out, and what it does. */
export class KitOption {
  declare name: string;
  declare type: string;
  declare initial?: string;
  declare does: string;
}

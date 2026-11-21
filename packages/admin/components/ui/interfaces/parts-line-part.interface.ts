import type { ReactNode } from 'react';

/** One named part of a `PartsLine`: what it is, and optionally a short detail, a count and a link. */
export interface IPartsLinePart {
  /** Stable key for the list. */
  key: string;
  label: ReactNode;
  /** A short qualifier printed after the label, quieter than it. */
  detail?: ReactNode;
  /** How many of the whole this part holds; printed as `×n`. */
  count?: number;
  /** Where the label leads, when the part is a record of its own. */
  href?: string;
}

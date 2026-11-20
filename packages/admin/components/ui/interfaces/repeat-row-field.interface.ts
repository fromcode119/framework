import type { ReactNode } from 'react';

/** One field of a RepeatRow: its words and the control that edits it. */
export interface IRepeatRowField {
  key: string;
  label?: string;
  control: ReactNode;
}

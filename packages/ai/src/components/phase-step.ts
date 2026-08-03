import type { ComponentType } from 'react';

/** One step in an assistant loading sequence — a label and the icon shown while it is active. */
export class PhaseStep {
  constructor(
    readonly label: string,
    readonly icon: ComponentType<{ size?: number; className?: string }>,
  ) {}
}

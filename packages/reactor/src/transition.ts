import { startTransition } from 'react';

/**
 * Low-priority (interruptible) updates, OOP-wrapped so code never calls `React.startTransition`
 * or the `useTransition` hook directly.
 *
 *   Transition.run(() => this.filter = value);   // heavy filter, kept off the critical path
 */
export class Transition {
  static run(update: () => void): void {
    startTransition(update);
  }
}

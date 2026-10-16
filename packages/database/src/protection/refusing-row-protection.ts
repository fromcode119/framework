import type { IRowProtection } from '@database/interfaces/row-protection.interface';

/**
 * The row protection of a driver that has none: it REFUSES rather than doing nothing, so nobody is told
 * a table is protected when it is not. Callers ask `supportsRowProtection()` first.
 */
export class RefusingRowProtection implements IRowProtection {
  constructor(private readonly driver: string) {}

  async protect(table: string): Promise<void> {
    throw new Error(`${this.driver} cannot protect the rows of "${table}": it has no triggers. Ask supportsRowProtection() first.`);
  }

  async allowWithinTransaction(): Promise<void> {
    throw new Error(`${this.driver} protects no rows, so there is nothing to allow. Ask supportsRowProtection() first.`);
  }
}

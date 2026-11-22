import chalk from 'chalk';

/**
 * Whether Docker has the memory for one more stack, said BEFORE the stack starts.
 *
 * Every stack runs its console and storefront as dev servers, each allowed several GiB, and Docker on one
 * machine is one VM shared by all of them. Past its memory the first thing to fail is not the newest stack
 * but whichever answers a health check late: the gateway stops and restarts ("no answer from its own
 * health check"), the console is killed and every page answers an empty reply for a minute. That looked
 * like a fault in each stack in turn, when it was the machine being full.
 */
export class StackCapacity {
  private static readonly GIB = 1024 ** 3;
  private static readonly UNITS: Record<string, number> = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 };

  /** What one dev server may take when its limit is written as "4G", "512m" or a plain byte count. */
  static bytesOf(limit: string | null): number {
    const match = /^\s*(\d+(?:\.\d+)?)\s*([kmg]?)b?\s*$/i.exec(String(limit ?? ''));
    if (!match) return 0;

    return Math.round(Number(match[1]) * (StackCapacity.UNITS[match[2].toLowerCase()] ?? 1));
  }

  /** The warning, or '' when the new stack fits next to the ones already live. */
  static warning(dockerBytes: number, live: readonly string[], perStackBytes: number): string {
    if (!(dockerBytes > 0) || !(perStackBytes > 0)) return '';
    const needed = (live.length + 1) * perStackBytes;
    if (needed <= dockerBytes) return '';

    const gib = (bytes: number) => (bytes / StackCapacity.GIB).toFixed(0);
    return [
      `Docker has ${gib(dockerBytes)} GiB; ${live.length + 1} stacks can take up to ${gib(needed)} GiB (${gib(perStackBytes)} GiB each).`,
      `  Live now: ${live.join(', ') || 'none'}.`,
      '  Past that the gateway misses its health check and restarts and the console is killed. Stop one you no longer use:',
      '  fromcode stack down <name>   (fromcode stack ls shows which sessions are quiet)',
    ].join('\n');
  }

  static print(text: string): void {
    if (text) console.log(chalk.yellow(`\n${text}\n`));
  }
}

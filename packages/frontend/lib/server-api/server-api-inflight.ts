/**
 * The api calls this storefront process has open right now, and since when.
 *
 * When a call times out, the question is whether the api was slow or this process was: a call can
 * wait on its own side — behind other calls, on a connection — while the api answers a fresh process
 * at once. Node's own connection counters are not exposed by the runtime this ships on, so the
 * fetch helpers count their calls themselves, and a timeout reports how many were open with it.
 */
export class ServerApiInflight {
  private static readonly open = new Map<number, number>();
  private static nextId = 0;

  /** Runs `call`, counted as open from start to finish. */
  static async track<T>(call: () => Promise<T>): Promise<T> {
    const id = ServerApiInflight.nextId++;
    ServerApiInflight.open.set(id, Date.now());
    try {
      return await call();
    } finally {
      ServerApiInflight.open.delete(id);
    }
  }

  /** `7 open, oldest 11950 ms` — or `none open`. */
  static describe(now: number = Date.now()): string {
    if (ServerApiInflight.open.size === 0) return 'none open';
    const oldest = Math.min(...ServerApiInflight.open.values());
    return `${ServerApiInflight.open.size} open, oldest ${now - oldest} ms`;
  }
}

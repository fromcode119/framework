/**
 * Releases a fetch response nobody is going to read.
 *
 * An unread body keeps its connection to the api checked out until the garbage collector finds the
 * response — so a long-lived storefront process that skipped a 404 or a 5xx on every render held a
 * socket each time, while a fresh process with none of that backlog was fast. Every server-side fetch
 * that decides not to read a response hands it here. No imports, so the middleware can use it too.
 */
export class ResponseDrain {
  static async discard(response: Response | null | undefined): Promise<void> {
    await response?.body?.cancel().catch(() => undefined);
  }
}

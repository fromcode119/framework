/**
 * Releases a fetch response nobody is going to read.
 *
 * An unread body keeps its connection to the api checked out until the garbage collector finds the
 * response — so a long-lived storefront process that skipped a 404 or a 5xx on every render held a
 * socket each time, while a fresh process with none of that backlog was fast. Every server-side fetch
 * that decides not to read a response hands it here. No imports, so the middleware can use it too.
 *
 * The cancel is STARTED, never awaited. A response Next keeps for `next.revalidate` has a TEED body
 * (one branch for the caller, one for its cache), and cancelling one branch of a tee does not resolve
 * until the other branch is cancelled as well — which nobody does. Awaited, every render that skipped
 * such a response waited forever: 0.2.295 took three storefronts down that way.
 */
export class ResponseDrain {
  static discard(response: Response | null | undefined): void {
    response?.body?.cancel().catch(() => undefined);
  }
}

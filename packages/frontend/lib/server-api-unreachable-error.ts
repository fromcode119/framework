/**
 * Thrown when a server-side API fetch could not reach the API at all (DNS failure, connect
 * timeout, socket reset, abort) — as opposed to the API answering "no such document".
 *
 * Routes MUST let this propagate rather than translating it into `notFound()`. A 500 is the
 * honest answer: it tells a visitor (and a crawler) "try again", whereas a 404 on a page that
 * exists asks Google to delist it.
 */
export class ServerApiUnreachableError extends Error {
  constructor(requestPath: string, cause?: unknown) {
    super(`Frontend could not reach the API for ${requestPath}`, { cause });
    this.name = 'ServerApiUnreachableError';
  }
}

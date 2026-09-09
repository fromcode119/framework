import { ClientRuntimeConstants, ClientType } from '@fromcode119/core/client';

/**
 * The development plugin-reload stream, read with `fetch` rather than `EventSource`.
 *
 * `EventSource` cannot set request headers — the API is cookies-only by design — and the api decides
 * which SURFACE a request belongs to from `x-framework-client`. Without that header a cookie-bearing
 * request on a workspace host is classified as a STOREFRONT visitor, and an admin session is then
 * correctly refused: the stream 401'd on every page load, for every console, and could never have
 * worked. `fetch` sends the header and exposes the body as a stream, which is the standard way to
 * consume server-sent events under an authenticated surface.
 *
 * Development only, and deliberately quiet: this drives hot reload, so a failure must cost the
 * operator a manual refresh and nothing else.
 */
export class HotReloadStreamService {
  /** SSE frames are separated by a blank line; a frame's payload lines are prefixed `data:`. */
  private static readonly FRAME_SEPARATOR = '\n\n';

  private controller: AbortController | null = null;

  /** Opens the stream. `onReload` is called with the slug of each plugin whose UI changed. */
  start(url: string, onReload: (slug: string) => void): void {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    void this.consume(url, controller, onReload);
  }

  /** Closes the stream. Safe to call when none is open. */
  stop(): void {
    this.controller?.abort();
    this.controller = null;
  }

  private async consume(url: string, controller: AbortController, onReload: (slug: string) => void): Promise<void> {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        headers: { [ClientRuntimeConstants.CLIENT_HEADER]: ClientType.ADMIN_UI.value },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        console.warn(`[HMR] Plugin reload stream unavailable (${response.status}). Reload the page to pick up plugin changes.`);
        return;
      }
      await this.read(response.body.getReader(), controller, onReload);
    } catch (error) {
      // An abort is this service being stopped — a normal shutdown, not a failure to report.
      if (controller.signal.aborted) return;
      console.warn('[HMR] Plugin reload stream ended. Reload the page to pick up plugin changes.', error);
    }
  }

  private async read(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    controller: AbortController,
    onReload: (slug: string) => void,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done || controller.signal.aborted) return;
      // `stream: true` keeps a multi-byte character split across two chunks intact.
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf(HotReloadStreamService.FRAME_SEPARATOR);
      while (separator !== -1) {
        this.dispatch(buffer.slice(0, separator), onReload);
        buffer = buffer.slice(separator + HotReloadStreamService.FRAME_SEPARATOR.length);
        separator = buffer.indexOf(HotReloadStreamService.FRAME_SEPARATOR);
      }
    }
  }

  private dispatch(frame: string, onReload: (slug: string) => void): void {
    const payload = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n');
    if (!payload) return;
    try {
      const data = JSON.parse(payload);
      if (data?.type === 'plugin:ui:reload' && data.slug) onReload(String(data.slug));
    } catch {
      // A heartbeat or a comment frame is not JSON. Nothing to do, and nothing worth logging.
    }
  }
}

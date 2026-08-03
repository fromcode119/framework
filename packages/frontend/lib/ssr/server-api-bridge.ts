import { bound } from '@fromcode119/reactor';

/**
 * The `api` a plugin client is constructed with during a server render.
 *
 * `ContextBridge.registerPluginClient` builds each client as `factory(ContextBridge.api, basePath)`, and
 * clients resolve their own absolute URLs through `requester.getBaseUrl()` — that is how the cms client
 * hands out image-optimizer URLs. Without a base URL those come back as bare paths, which resolve against
 * the FRONTEND origin instead of the api and quietly defeat the optimizer, so the storefront ships the
 * full-size original.
 *
 * The request methods never settle. Data loading during a server render is not wanted (the components
 * fetch from effects, which `renderToStaticMarkup` never runs) and a resolved promise would fire a
 * `.then` that calls `setState` on an instance React never mounted. A promise that never settles is
 * collected with the render and makes no noise.
 */
export class ServerApiBridge {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = String(baseUrl || '');
  }

  @bound getBaseUrl(): string {
    return this.baseUrl;
  }

  @bound get(): Promise<never> {
    return ServerApiBridge.pending();
  }

  @bound post(): Promise<never> {
    return ServerApiBridge.pending();
  }

  @bound put(): Promise<never> {
    return ServerApiBridge.pending();
  }

  @bound patch(): Promise<never> {
    return ServerApiBridge.pending();
  }

  @bound delete(): Promise<never> {
    return ServerApiBridge.pending();
  }

  private static pending(): Promise<never> {
    return new Promise<never>(() => undefined);
  }
}

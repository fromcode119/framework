import { EnvUtils } from '@core/utils/env-utils';

/**
 * Which plugins an `extension-host` runs. A deployment may run plugins a SITE uploaded in a host of
 * their own — its own container, no network, and on a box that has one a sandboxing runtime such as
 * gVisor, which puts a user-space kernel between that code and the box's own. A plugin a site uploaded
 * is the platform's least trusted code; a flaw it reaches in the kernel should land in the sandbox,
 * not on the box every site runs on.
 *
 * Each host says which pool it is (`EXTENSION_HOST_POOL`, `platform` unless set) in its announcement;
 * the api starts every plugin in its pool. A deployment that runs a site pool says so to the api
 * (`EXTENSION_HOST_SITE_POOL=required`), and from then on a site's plugin starts in that pool or not at
 * all — never quietly beside the platform's plugins because the sandbox is down.
 */
export class ExtensionHostPool {
  static readonly ENV = 'EXTENSION_HOST_POOL';
  static readonly SITE_REQUIRED_ENV = 'EXTENSION_HOST_SITE_POOL';
  static readonly PLATFORM = 'platform';
  static readonly SITE = 'site';

  /** A pool name as announced or configured; anything but `site` is the platform's. */
  static of(value: unknown): string {
    return String(value ?? '').trim() === ExtensionHostPool.SITE ? ExtensionHostPool.SITE : ExtensionHostPool.PLATFORM;
  }

  /** The pool THIS host runs (read in the extension-host container). */
  static ofThisHost(): string {
    return ExtensionHostPool.of(EnvUtils.text(ExtensionHostPool.ENV));
  }

  /** Whether this deployment runs plugins sites uploaded in a pool of their own (read by the api). */
  static siteRequired(): boolean {
    return EnvUtils.text(ExtensionHostPool.SITE_REQUIRED_ENV).trim() === 'required';
  }

  /** The pool a plugin starts in. */
  static forPlugin(siteOwned: boolean): string {
    return siteOwned && ExtensionHostPool.siteRequired() ? ExtensionHostPool.SITE : ExtensionHostPool.PLATFORM;
  }
}

import fs from 'fs';
import { Module } from 'module';
import path from 'path';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginModuleResolverService } from '@core/plugin/services/installation/plugin-module-resolver-service';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginGuestContextFactory } from '@core/plugin/host/plugin-guest-context-factory';
import { PluginGuestCoreBridge } from '@core/plugin/host/plugin-guest-core-bridge';
import { PluginGuestHandlers } from '@core/plugin/host/plugin-guest-handlers';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import { PluginGuestState } from '@core/plugin/host/plugin-guest-state';
import type { IPluginGuestBoot } from '@core/plugin/host/interfaces/plugin-guest-boot.interface';
import type { IPluginInvocation } from '@core/plugin/host/interfaces/plugin-invocation.interface';
import type { PluginContext } from '@core/plugin/plugin-context';

/**
 * The plugin's process. Loads the plugin exactly as the scanner would in-process, gives it a context
 * made of RPC stand-ins, serves its routes on a Unix socket, and runs whatever the host asks for —
 * always inside the invocation the host named, so every call back carries that invocation's token.
 *
 * Nothing here has secrets: the environment is empty, the only configuration is the `boot` message.
 */
export class PluginGuest {
  private static readonly CALL_TIMEOUT_MS = 60_000;

  private readonly channel: PluginChannel;
  private readonly remote: PluginGuestRemote;
  private readonly handlers = new PluginGuestHandlers();
  private readonly state = new PluginGuestState();
  private http: PluginGuestHttp | null = null;
  private boot: IPluginGuestBoot | null = null;
  private contract: Record<string, any> = {};
  private context: PluginContext | null = null;

  constructor(transport: ConstructorParameters<typeof PluginChannel>[0]) {
    this.channel = new PluginChannel(transport);
    this.remote = new PluginGuestRemote(this.channel, PluginGuest.CALL_TIMEOUT_MS, (handler) => this.handlers.keepStable(handler), (id) => this.handlers.take(id));
    this.channel.serve((type, payload) => this.handle(type, payload));
  }

  private async handle(type: string, payload: any): Promise<unknown> {
    switch (type) {
      case 'boot': return this.start(payload as IPluginGuestBoot);
      case 'invoke': return this.invoke(payload as IPluginInvocation);
      case 'stop': return this.stop();
      case 'ping': return 'pong';
      default: throw new Error(`guest: unknown message "${type}"`);
    }
  }

  /** Loads the plugin and reports which lifecycle hooks and public-API functions it has. */
  private async start(boot: IPluginGuestBoot): Promise<{ contractKeys: string[]; publicApiKeys: string[]; manifest: unknown }> {
    this.boot = boot;
    process.env.FROMCODE_PROJECT_ROOT = boot.projectRoot;
    process.chdir(boot.projectRoot);
    PluginGuest.shareFrameworkModules(boot.projectRoot);
    PluginGuestCoreBridge.install(this.channel, this.remote, this.handlers);

    this.http = new PluginGuestHttp(boot.socketPath, this.remote, boot.socketMode);
    this.context = new PluginGuestContextFactory(this.channel, this.remote, this.handlers, this.http, this.state, boot).create();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rawModule = require(path.resolve(boot.entryPath));
    this.contract = PluginModuleResolverService.resolve(rawModule);
    await this.http.listen();

    const contractKeys = ['onInstall', 'onInit', 'onUpdate', 'onEnable', 'onDisable', 'onUninstall'].filter((key) => typeof this.contract[key] === 'function');
    // A plugin's `publicAPI` is often a CLASS of static methods, and static methods are not
    // enumerable — `Object.keys` saw none of them, so every peer's `finance.getCapabilities()` failed
    // with "not callable" while the same call worked in-process. Own property names, functions only.
    const publicApiKeys = PluginGuest.functionNames(this.contract.publicAPI);
    return { contractKeys, publicApiKeys, manifest: this.contract.manifest ?? null };
  }

  /** Function-valued own properties of an object OR class (static methods included). */
  static functionNames(api: unknown): string[] {
    if (!api || (typeof api !== 'object' && typeof api !== 'function')) return [];
    return Object.getOwnPropertyNames(api)
      .filter((key) => !['length', 'name', 'prototype', 'caller', 'arguments'].includes(key))
      .filter((key) => typeof (api as Record<string, unknown>)[key] === 'function');
  }

  private async invoke(invocation: IPluginInvocation): Promise<unknown> {
    if (!this.context) throw new Error('guest: invoked before boot');
    this.state.update(invocation);
    // The result crosses as data too: a provider factory's instance with methods, a callback's return —
    // functions in it become handles, exactly as in arguments.
    return PluginGuestRemote.invocation.run({ token: invocation.token, tenantId: invocation.tenantId }, () =>
      RequestContextUtils.storage.run({ locale: invocation.locale, tenantId: invocation.tenantId ?? undefined }, async () => this.remote.portableResult(await this.run(invocation))));
  }

  private async run(invocation: IPluginInvocation): Promise<unknown> {
    const context = this.context as PluginContext;
    // The contract mirror: filled at the first lifecycle call and refreshed at the first request.
    await PluginGuestCoreBridge.primeFor(invocation.kind, this.remote);
    if (invocation.kind === 'lifecycle') {
      const hook = this.contract[String(invocation.name)];
      if (typeof hook !== 'function') return undefined;
      return hook(context, ...(invocation.args ?? []));
    }
    if (invocation.kind === 'public-api') {
      const fn = this.contract.publicAPI?.[String(invocation.name)];
      if (typeof fn !== 'function') throw new Error(`guest: no public API function "${invocation.name}"`);
      return fn(...(invocation.args ?? []));
    }
    const handler = this.handlers.take(String(invocation.handlerId));
    if (!handler) throw new Error(`guest: unknown handler ${invocation.handlerId}`);
    return handler(...(invocation.args ?? []));
  }

  /**
   * The same resolution the scanner gives in-process plugins: a plugin's `require('@fromcode119/sdk')`
   * resolves through the platform's `node_modules`, whatever directory the plugin lives in.
   */
  private static shareFrameworkModules(projectRoot: string): void {
    const projectNodeModules = path.resolve(projectRoot, 'node_modules');
    if (!fs.existsSync(projectNodeModules)) return;
    const existing = String(process.env.NODE_PATH || '').split(path.delimiter).map((entry) => entry.trim()).filter(Boolean);
    if (!existing.includes(projectNodeModules)) {
      process.env.NODE_PATH = [projectNodeModules, ...existing].join(path.delimiter);
      (Module as any)._initPaths();
    }
  }

  private async stop(): Promise<void> {
    await this.http?.close();
    setTimeout(() => process.exit(0), 50);
  }
}

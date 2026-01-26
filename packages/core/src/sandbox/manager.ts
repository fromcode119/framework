import vm from 'vm';
import { PluginContext } from '../types';

export class PluginSandbox {
  private context: vm.Context;

  constructor(ctx: PluginContext) {
    this.context = vm.createContext({
      console,
      process: {
        env: { NODE_ENV: process.env.NODE_ENV },
      },
      require: this.createRequire(),
      // Inject services from PluginContext
      db: ctx.db,
      api: ctx.api,
      hooks: ctx.hooks,
      logger: ctx.logger,
      cache: ctx.cache,
      storage: ctx.storage,
      plugin: ctx.plugin,
      plugins: ctx.plugins,
    });
  }

  private createRequire() {
    // Basic require shim for sandbox
    return (moduleName: string) => {
      // White-listed modules
      const allowed = ['path', 'url', 'util'];
      if (allowed.includes(moduleName)) {
        return require(moduleName);
      }
      throw new Error(`Access to module "${moduleName}" is restricted in sandbox.`);
    };
  }

  async run(code: string) {
    const script = new vm.Script(code);
    return script.runInContext(this.context);
  }
}

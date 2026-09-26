import { Request, Response } from 'express';
import { BaseController, CoercionUtils, PluginManager } from '@fromcode119/core';

/**
 * What one plugin's code is running as, right now — for the operator, who otherwise cannot tell where
 * a plugin runs or what a deploy does to it.
 *
 * An isolated plugin answers with its process (where it is started, pid, OS user, limits, recent
 * restarts) and what the process reports about itself (memory, uptime, everything it registered). A
 * plugin that runs inside the api process has no process of its own, and the answer says exactly that
 * rather than an empty process.
 */
export class PluginRuntimeController extends BaseController {
  constructor(private manager: PluginManager) {
    super();
  }

  async runtime(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    if (!this.manager.getPlugins().some((plugin) => plugin.manifest.slug === slug)) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    const host = this.manager.pluginHosts.get(slug);
    if (!host) return res.json({ slug, isolated: false, runtime: null });
    return res.json({ slug, isolated: true, runtime: await host.runtime() });
  }
}

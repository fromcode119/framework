import { Request, Response } from 'express';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';
import { TenantConnectionScope } from '@fromcode119/database';
import { ContentPreviewAccessUtils, PluginState, SystemUpdateService } from '@fromcode119/core';
import { ResolvedDocResponseService } from '@api/services/resolved-doc-response-service';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { CoercionUtils } from '@fromcode119/core';

export class SystemRuntimeController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getActivity(req: Request, res: Response) {
    return this.runtime.restController.getGlobalActivity(this.runtime.manager.getCollections(), req, res);
  }

  async getShortcodes(req: Request, res: Response) {
    const docs = await this.runtime.shortcodes.getRegisteredShortcodes();
    res.json({ docs, totalDocs: docs.length });
  }

  async renderShortcodes(req: Request, res: Response) {
    try {
      const result = await this.runtime.shortcodes.render(req.body.content, {
        user: (req as any).user,
        maxShortcodes: req.body.maxShortcodes,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getLogs(req: Request, res: Response) {
    try {
      const query = {
        page: parseInt(req.query.page as string, 10),
        limit: parseInt(req.query.limit as string, 10),
        search: req.query.search as string,
      };
      // Same rule as the audit trail below: the journal is tenant-scoped by policy, and only a
      // PLATFORM admin asks to read across every site.
      const platformAdmin = await new PlatformAccessResolver(this.runtime.db).isPlatformAdmin(req);
      res.json(platformAdmin
        ? await this.runtime.db.withPlatformAdmin(() => this.runtime.system.getLogs(query))
        : await this.runtime.system.getLogs(query));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAuditLogs(req: Request, res: Response) {
    try {
      const query = {
        page: parseInt(req.query.page as string, 10),
        limit: parseInt(req.query.limit as string, 10),
        search: req.query.search as string,
        status: req.query.status as string,
      };
      // The trail is tenant-scoped by policy, so this request already sees only the site it is acting
      // in. A PLATFORM admin is the exception and asks for it explicitly: this is the security log of
      // the whole container, and an operator investigating an incident cannot be made to enter each
      // site in turn. The marker lives on the connection for this read alone.
      const platformAdmin = await new PlatformAccessResolver(this.runtime.db).isPlatformAdmin(req);
      res.json(platformAdmin
        ? await this.runtime.db.withPlatformAdmin(() => this.runtime.system.getAuditLogs(query))
        : await this.runtime.system.getAuditLogs(query));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async checkUpdate(req: Request, res: Response) {
    try {
      res.json(await SystemUpdateService.checkUpdate());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async applyUpdate(req: Request, res: Response) {
    try {
      res.json(await SystemUpdateService.applyUpdate());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDataSources(req: Request, res: Response) {
    try {
      const docs = this.runtime.manager.getCollections().map((collection) => ({
        slug: collection.slug,
        shortSlug: collection.shortSlug || collection.slug,
        label: (collection as any).label || collection.slug,
        hidden: !!collection.admin?.hidden,
      }));
      res.json({ docs, totalDocs: docs.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async queryDataSource(req: Request, res: Response) {
    try {
      const source = CoercionUtils.toString(req.query?.source) || CoercionUtils.toString(req.body?.source) || CoercionUtils.toString(req.query?.slug) || CoercionUtils.toString(req.body?.slug);
      if (!source) {
        return res.status(400).json({ error: 'source is required' });
      }

      const collection = this.runtime.manager.getCollections().find((item: any) => {
        return item.slug === source || item.shortSlug === source || item.unprefixedSlug === source;
      });
      if (!collection) {
        return res.status(404).json({ error: `Unknown data source: ${source}` });
      }

      const mergedQuery = { ...(req.query as any), ...(req.body || {}) } as any;
      delete mergedQuery.source;
      const data = await this.runtime.restController.find(collection, {
        query: mergedQuery,
        user: (req as any).user,
        locale: (req as any).locale,
        headers: req.headers,
        cookies: (req as any).cookies,
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getI18n(req: Request, res: Response) {
    const locale = (req.query.locale as string) || 'en';
    const activeSlugs = new Set(
      this.runtime.manager.getPlugins().filter((plugin) => plugin.state === PluginState.ACTIVE).map((plugin) => plugin.manifest.slug)
    );
    const translations = (this.runtime.manager as any).i18n.translations.get(locale) || {};
    const filtered: any = {};
    for (const [slug, data] of Object.entries(translations)) {
      if (activeSlugs.has(slug)) {
        filtered[slug] = data;
      }
    }
    res.json(filtered);
  }

  async resolveSlug(req: Request, res: Response) {
    try {
      const slug = req.query.slug as string;
      if (!slug) {
        return res.status(400).json({ error: 'Slug is required' });
      }

      // Preview is decided by the SESSION, never by the query string. `?preview=1`/`?draft=1` used to
      // be OR-ed in here, so any anonymous visitor could read every draft by asking for one.
      const result = await this.runtime.resolution.resolveSlug(slug, {
        user: (req as any).user,
        preview: ContentPreviewAccessUtils.canPreviewUnpublished((req as any).user),
        locale: req.query.locale as string,
        fallback_locale: req.query.fallback_locale as string,
        locale_mode: req.query.locale_mode as string,
      });

      if (!result) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(ResolvedDocResponseService.normalizeResult(result));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getEvents(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // Give the request's pooled connection back BEFORE the stream starts.
    //
    // A tenant-bound request holds one client for as long as the response is open, and this response
    // never closes — it is the admin's event stream. Every page load opens another, so a handful of
    // navigations checked out the whole pool and every later request waited for a client that could
    // only come back when the operator closed the tab. The api answered untenanted routes and nothing
    // else, which reads as "the admin went white".
    //
    // It stayed invisible until admin sessions actually carried a site: with no tenant there was no
    // scope, and the scope's client is taken LAZILY on the first statement, so a stream that queries
    // nothing held nothing. The scope stays open here — a later statement would take a fresh client
    // and set the tenant again — this only gives back the one nothing is using.
    await TenantConnectionScope.releaseCurrent();
    // Writing to a destroyed socket THROWS, and a throw inside a hook callback or a timer has no
    // caller to catch it — it becomes an uncaughtException and takes the process down. `close` does not
    // fire for every abrupt teardown, so the write itself has to be the thing that gives up.
    const stop = () => {
      clearInterval(heartbeat);
      this.runtime.manager.hooks.off('system:hmr:reload', handler);
    };
    const write = (chunk: string) => {
      try {
        res.write(chunk);
      } catch {
        stop();
      }
    };
    const handler = (data: any) => write(`data: ${JSON.stringify(data)}\n\n`);
    this.runtime.manager.hooks.on('system:hmr:reload', handler);
    const heartbeat = setInterval(() => write(': heartbeat\n\n'), 15000);
    // Reap the stream from BOTH ends. `req`'s close is the documented client-abort signal, but behind a
    // reverse proxy the api often never sees it — six streams were opened during one burst of admin
    // navigation and not one closed, until the browser hit its per-host connection limit and every
    // other api call queued behind them. `res`'s close fires when the underlying connection goes, and
    // the heartbeat below is the backstop: a write to a socket nobody is reading eventually fails.
    req.on('close', stop);
    res.on('close', stop);
  }

  async sendTestTelemetryEmail(req: Request, res: Response) {
    try {
      const user = ((req as any).user || {}) as { id?: string | number; email?: string; roles?: string[] };
      const result = await (this.runtime.manager as any).sendTestEmailTelemetry({
        id: user.id,
        email: user.email,
        roles: Array.isArray(user.roles) ? user.roles : [],
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to send telemetry test email' });
    }
  }
}
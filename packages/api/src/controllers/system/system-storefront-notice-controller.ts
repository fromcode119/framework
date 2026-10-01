import type { Request, Response } from 'express';
import { RequestContextUtils, StorefrontNoticeDisplay, StorefrontNoticeTokens } from '@fromcode119/core';
import type { IPluginManagerInterface } from '@fromcode119/core';

/**
 * What a one-time storefront notice says (`?fc_notice=` — see StorefrontNoticeTokens).
 *
 * Public on purpose: the visitor it is for has just followed a link from an email and usually has no
 * session. The signed token IS the credential — the words, the site and the display all come out of it,
 * and a token minted for another site, for the other display, expired or edited reads as no notice.
 */
export class SystemStorefrontNoticeController {
  private readonly tokens: StorefrontNoticeTokens;

  constructor(manager: IPluginManagerInterface) {
    this.tokens = new StorefrontNoticeTokens(manager);
  }

  async resolve(req: Request, res: Response): Promise<void> {
    // A notice is one person's; nothing in front of the api may keep it for the next visitor.
    res.set('Cache-Control', 'no-store');
    const token = String((req.query as Record<string, unknown>)?.token ?? '').trim();
    const display = StorefrontNoticeDisplay.parse((req.query as Record<string, unknown>)?.display);
    const tenantId = String((req as unknown as { tenantId?: string }).tenantId || RequestContextUtils.getTenantId() || '').trim() || null;
    if (!token || !display) {
      res.status(404).json({ notice: null });
      return;
    }
    try {
      const notice = await this.tokens.verify(token, tenantId, display);
      if (!notice) {
        res.status(404).json({ notice: null });
        return;
      }
      res.json({ notice });
    } catch {
      // A key that cannot be read means "cannot verify", which must read as no notice — never as one.
      res.status(404).json({ notice: null });
    }
  }
}

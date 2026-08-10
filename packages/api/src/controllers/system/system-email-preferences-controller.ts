import type { Request, Response } from 'express';

/**
 * A person's own email-stream preferences.
 *
 * The address ALWAYS comes from the session, never from the request. Accepting one from the body or
 * the query would let any authenticated user unsubscribe (or resubscribe) anyone else by typing their
 * address — a textbook IDOR on a surface that decides whether real mail reaches a real person.
 *
 * Only DECLARED streams are listed and accepted. Transactional mail carries no category and must never
 * appear here: a receipt is not a subscription, and offering to switch it off would be a lie.
 */
export class SystemEmailPreferencesController {
  constructor(
    protected readonly manager: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    private readonly translate: (key: string, fallback: string) => string,
  ) {}

  private get email(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    return this.manager?.integrations?.email;
  }

  /**
   * Who this request is acting for. The session is the answer here; the token-authenticated twin
   * overrides it, and that override is the ONLY difference between the two surfaces — everything
   * below is identical, so it is inherited rather than copied.
   */
  protected async resolveAddress(req: Request): Promise<string> {
    return String((req as any).user?.email || '').trim().toLowerCase(); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  /** Recorded against a suppression so an operator can see WHERE an opt-out came from. */
  protected get suppressionSource(): string {
    return 'account:email-preferences';
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const address = await this.resolveAddress(req);
      if (!address) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const categories = this.manager?.emailCategories?.list?.() ?? [];
      const preferences = await Promise.all(categories.map(async (category: any) => ({
        key: category.key,
        label: this.translate(category.labelKey, category.key),
        description: this.translate(category.descriptionKey, ''),
        // `subscribed` rather than `suppressed`: the screen asks "do you want this?", and a toggle
        // whose ON means "off" is how preference screens get inverted.
        subscribed: !(await this.email?.isSuppressed?.(address, category.key)),
      })));

      res.json({ address, preferences });
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      res.status(err?.status ?? 500).json({ error: err?.message ?? 'Internal server error' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const address = await this.resolveAddress(req);
      if (!address) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const key = String((req.body as any)?.key || '').trim(); // eslint-disable-line @typescript-eslint/no-explicit-any
      // An unknown key must be refused, not silently written: the suppression list would happily store
      // a typo'd category forever, suppressing a stream that does not exist while the real one keeps sending.
      if (!this.manager?.emailCategories?.has?.(key)) {
        res.status(400).json({ error: 'Unknown email category' });
        return;
      }

      const subscribed = (req.body as any)?.subscribed === true; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (subscribed) {
        await this.email?.unsuppress?.(address, key);
      } else {
        await this.email?.suppress?.(address, key, this.suppressionSource);
      }

      res.json({ ok: true, key, subscribed });
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      res.status(err?.status ?? 500).json({ error: err?.message ?? 'Internal server error' });
    }
  }
}

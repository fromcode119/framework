import { AssistantCollectionContext, PluginManager, ThemeManager } from '@fromcode119/core';
import { Request } from 'express';
import { RESTController } from '../rest-controller';

export class ForgeCatalogService {
  constructor(
    private manager: PluginManager,
    private themeManager: ThemeManager,
    private restController: RESTController,
    private normalizeText: (value: string) => string,
  ) {}

  isCollectionAllowed(collection: any): boolean {
    const slug = String(collection?.slug || '').trim().toLowerCase();
    if (!slug) return false;
    if (slug.startsWith('_system_')) return false;
    return true;
  }

  getCollectionsContext(): AssistantCollectionContext[] {
    return this.manager
      .getCollections()
      .filter((collection: any) => this.isCollectionAllowed(collection))
      .map((collection: any) => ({
        slug: collection.slug,
        shortSlug: collection.shortSlug || collection.slug,
        label: (collection as any).label || collection.slug,
        pluginSlug: collection.pluginSlug || 'system',
        raw: collection,
      }));
  }

  findCollectionBySlug(source: string): AssistantCollectionContext | null {
    const normalized = String(source || '').trim().toLowerCase();
    const collection = this.manager.getCollections().find((entry: any) => {
      const slug = String(entry.slug || '').toLowerCase();
      const shortSlug = String(entry.shortSlug || '').toLowerCase();
      const unprefixedSlug = String(entry.unprefixedSlug || '').toLowerCase();
      return slug === normalized || shortSlug === normalized || unprefixedSlug === normalized;
    });

    if (!collection) return null;
    if (!this.isCollectionAllowed(collection)) return null;
    return {
      slug: collection.slug,
      shortSlug: collection.shortSlug || collection.slug,
      label: (collection as any).label || collection.slug,
      pluginSlug: collection.pluginSlug || 'system',
      raw: collection,
    };
  }

  getPluginSummary(): Array<{ slug: string; name: string; version: string; state: string }> {
    return this.manager.getSortedPlugins(this.manager.getPlugins()).map((plugin: any) => ({
      slug: String(plugin?.manifest?.slug || '').trim(),
      name: String(plugin?.manifest?.name || plugin?.manifest?.slug || '').trim(),
      version: String(plugin?.manifest?.version || '').trim(),
      state: String(plugin?.state || 'unknown').trim(),
    }));
  }

  getThemeSummary(): Array<{ slug: string; name: string; version: string; state: string }> {
    return this.themeManager.getThemes().map((theme: any) => ({
      slug: String(theme?.slug || '').trim(),
      name: String(theme?.name || theme?.slug || '').trim(),
      version: String(theme?.version || '').trim(),
      state: String(theme?.state || 'inactive').trim(),
    }));
  }

  isInventoryQuery(message: string): boolean {
    const normalized = this.normalizeText(message || '');
    if (!normalized) return false;
    const asksList = /\b(list|show|what|which|inventory)\b/.test(normalized);
    const asksPlugins = /\bplugin\b|\bplugins\b/.test(normalized);
    const asksTheme = /\btheme\b|\bthemes\b/.test(normalized);
    const asksCollections = /\bcollection\b|\bcollections\b|\beditable\b|\bcontent types?\b/.test(normalized);
    const hitCount = [asksPlugins, asksTheme, asksCollections].filter(Boolean).length;
    return asksList && hitCount >= 2;
  }

  detectInboxFormsQuery(message: string): { emails: boolean; forms: boolean } | null {
    const normalized = this.normalizeText(message || '');
    if (!normalized) return null;
    const asksEmails = /\bemail\b|\bemails\b|\bmail\b|\binbox\b/.test(normalized);
    const asksForms = /\bform\b|\bforms\b|\bsubmission\b|\bsubmissions\b|\blead\b|\bleads\b/.test(normalized);
    if (!asksEmails && !asksForms) return null;
    return { emails: asksEmails, forms: asksForms };
  }

  buildInventoryMessage(): string {
    const plugins = this.getPluginSummary();
    const themes = this.getThemeSummary();
    const activeTheme = themes.find((item) => item.state.toLowerCase() === 'active') || null;
    const collections = this.getCollectionsContext();

    const pluginLines = plugins.length
      ? plugins
          .slice(0, 8)
          .map((item) => `- ${item.name || item.slug} (${item.slug}) • ${item.version || 'n/a'} • ${item.state}`)
          .join('\n')
      : '- None detected';

    const collectionLines = collections.length
      ? collections
          .slice(0, 12)
          .map((item) => `- ${item.label || item.slug} (${item.shortSlug || item.slug})`)
          .join('\n')
      : '- None detected';

    return [
      'Here is your current workspace inventory:',
      '',
      `Installed plugins (${plugins.length}):`,
      pluginLines,
      '',
      `Active theme: ${activeTheme ? `${activeTheme.name || activeTheme.slug} (${activeTheme.slug})` : 'No active theme'}`,
      '',
      `Editable collections (${collections.length}):`,
      collectionLines,
    ].join('\n');
  }

  async buildInboxFormsMessage(
    req: Request,
    intent: { emails: boolean; forms: boolean },
  ): Promise<string> {
    const collections = this.getCollectionsContext();
    const emailKeywords = ['email', 'mail', 'inbox', 'message', 'contact', 'lead', 'form', 'submission'];
    const formKeywords = ['form', 'submission', 'lead', 'contact', 'inquiry', 'enquiry'];
    const keywords = Array.from(
      new Set([
        ...(intent.emails ? emailKeywords : []),
        ...(intent.forms ? formKeywords : []),
      ]),
    );

    const candidates = collections
      .filter((collection) => this.collectionMatchesKeywords(collection, keywords))
      .slice(0, 12);

    if (!candidates.length) {
      return intent.emails && intent.forms
        ? 'I checked your current scope, but I could not find email/form-specific collections to query directly.'
        : intent.emails
          ? 'I checked your current scope, but I could not find email-specific collections to query directly.'
          : 'I checked your current scope, but I could not find form submission collections to query directly.';
    }

    const user = (req as any).user;
    const sectionLines: string[] = [];
    let totalRecords = 0;
    let collectionsWithData = 0;

    for (const collection of candidates) {
      try {
        const rawCollection = collection.raw || collection;
        const response = await this.restController.find(rawCollection, {
          query: {
            limit: 5,
            offset: 0,
            preview: true,
          },
          user,
          headers: req.headers,
          cookies: (req as any).cookies,
        });
        const docs = Array.isArray(response?.docs) ? response.docs : [];
        const total = Number(response?.totalDocs || docs.length || 0);
        totalRecords += total;
        if (total > 0) collectionsWithData += 1;

        sectionLines.push(`- ${collection.slug}: ${total} record${total === 1 ? '' : 's'}`);
        for (const doc of docs.slice(0, 3)) {
          sectionLines.push(`  • ${this.extractRecordSnippet(doc)}`);
        }
      } catch {
        sectionLines.push(`- ${collection.slug}: unable to read`);
      }
    }

    const scopeLabel = intent.emails && intent.forms ? 'emails and form submissions' : intent.emails ? 'emails' : 'form submissions';
    return [
      `Here is what I found for ${scopeLabel}:`,
      '',
      `Collections checked: ${candidates.length}`,
      `Collections with data: ${collectionsWithData}`,
      `Total records found: ${totalRecords}`,
      '',
      ...sectionLines,
    ].join('\n');
  }

  private collectionMatchesKeywords(collection: AssistantCollectionContext, keywords: string[]): boolean {
    const haystack = this.normalizeText(
      [
        collection.slug,
        collection.shortSlug,
        collection.label,
        collection.pluginSlug,
      ]
        .filter(Boolean)
        .join(' '),
    );
    return keywords.some((keyword) => haystack.includes(keyword));
  }

  private extractRecordValue(record: any, keys: string[]): string {
    const sources = [record, record?.data, record?.payload, record?.meta].filter(Boolean);
    for (const key of keys) {
      for (const source of sources) {
        const value = source?.[key];
        if (value === undefined || value === null) continue;
        const text = String(value).trim();
        if (text) return text;
      }
    }
    return '';
  }

  private extractRecordSnippet(record: any): string {
    const id = this.extractRecordValue(record, ['id', '_id', 'uuid']) || 'n/a';
    const email = this.extractRecordValue(record, ['email', 'from', 'fromEmail', 'senderEmail']);
    const subject = this.extractRecordValue(record, ['subject', 'title', 'name', 'formName']);
    const createdAt = this.extractRecordValue(record, ['createdAt', 'submittedAt', 'updatedAt', 'date']);
    const message = this.extractRecordValue(record, ['message', 'body', 'content', 'note']);
    const parts = [
      `id:${id}`,
      email ? `email:${email}` : '',
      subject ? `subject:${subject}` : '',
      createdAt ? `at:${createdAt}` : '',
      message ? `message:${message.slice(0, 80)}${message.length > 80 ? '...' : ''}` : '',
    ].filter(Boolean);
    return parts.join(' • ');
  }
}

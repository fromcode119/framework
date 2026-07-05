import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

/**
 * Renders the framework's public developer portal — a Redoc viewer over the live `/openapi.json` (which
 * self-generates from the running collection schemas). The markup lives in a Handlebars template file
 * (`templates/developer-portal.html`); this class only compiles it with the spec URL. Public, no auth.
 */
export class DeveloperPortalHtml {
  private static compiled: HandlebarsTemplateDelegate<{ specUrl: string }> | null = null;

  static render(specUrl: string): string {
    if (!DeveloperPortalHtml.compiled) {
      // The template sits in a `templates/` folder next to this module in BOTH layouts — `src/utils`
      // in dev and `dist/utils` when packaged (the build's copy:templates step mirrors it into dist) —
      // so a single __dirname-relative path resolves correctly in either.
      const template = fs.readFileSync(path.join(__dirname, 'templates/developer-portal.html'), 'utf8');
      DeveloperPortalHtml.compiled = Handlebars.compile<{ specUrl: string }>(template);
    }
    return DeveloperPortalHtml.compiled({ specUrl });
  }
}

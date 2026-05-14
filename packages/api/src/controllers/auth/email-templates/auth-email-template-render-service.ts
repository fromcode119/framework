import Handlebars from 'handlebars';

export class AuthEmailTemplateRenderService {
  static render(template: string, tokens: Record<string, string>): string {
    return Handlebars.compile(String(template || ''), {
      noEscape: true,
    })(tokens);
  }

  static escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

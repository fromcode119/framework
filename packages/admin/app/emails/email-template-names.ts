import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { EmailCatalogText } from '@/app/emails/email-catalog-text';

/**
 * The catalog's name for each template id, so the log shows "Security notice" where it recorded
 * `platform:security-notification`. A template no longer in the catalog (its plugin was removed)
 * has no name here and is shown by its recorded id.
 */
export class EmailTemplateNames {
  static async load(): Promise<Map<string, string>> {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.EMAILS.CATALOG);
      const rows: any[] = Array.isArray(response?.templates) ? response.templates : [];
      return new Map(rows.map((row) => [String(row.id), EmailCatalogText.label(row)]));
    } catch {
      return new Map();
    }
  }

  static of(names: Map<string, string>, id: unknown): string {
    return names.get(String(id)) || String(id);
  }
}

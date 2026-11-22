import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants/admin.constants';

/** `/settings/integrations/email` — the address the server's own messages name — opens that type on the integrations page. */
export class IntegrationTypeAliasPageRoute {
  static async render({ params }: { params: Promise<{ type: string }> }) {
    const { type } = await params;
    redirect(AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(type));
  }
}

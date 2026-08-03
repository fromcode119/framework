import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants/admin.constants';

export class ThemeSettingsAliasPageRoute {
  static async render({
    params,
  }: {
    params: Promise<{ slug: string }>;
  }) {
    const { slug } = await params;
    redirect(AdminConstants.ROUTES.THEMES.SETTINGS_TAB(slug));
  }
}

import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants';

export default async function ThemeSettingsAliasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(AdminConstants.ROUTES.THEMES.SETTINGS_TAB(slug));
}

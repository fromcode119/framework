import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/constants';

export default async function ThemeSettingsAliasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(ROUTES.THEMES.SETTINGS_TAB(slug));
}

import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants';

export default function ThemesPage() {
  redirect(AdminConstants.ROUTES.THEMES.INSTALLED);
}

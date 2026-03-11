import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants';

export default function SettingsPage() {
  redirect(AdminConstants.ROUTES.SETTINGS.GENERAL);
  return null;
}

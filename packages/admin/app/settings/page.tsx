import { redirect } from 'next/navigation';
import { ROUTES } from '../../lib/constants';

export default function SettingsPage() {
  redirect(ROUTES.SETTINGS.GENERAL);
  return null;
}

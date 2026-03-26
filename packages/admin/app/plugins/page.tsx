import { redirect } from 'next/navigation';
import { AdminConstants } from '@/lib/constants';

export default function PluginsPage() {
  redirect(AdminConstants.ROUTES.PLUGINS.INSTALLED);
}

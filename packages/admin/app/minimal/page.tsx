import { AppPathConstants } from '@fromcode119/core/client';
import { redirect } from 'next/navigation';

export default function MinimalModePage() {
  redirect(AppPathConstants.ADMIN.MINIMAL);
}

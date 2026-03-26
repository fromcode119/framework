"use client";

import UserSecurityView from './components/user-security-view';
import { UserSecurityPageController } from './user-security-page-controller';

export default function UserSecurityPageClient() {
  const model = UserSecurityPageController.useModel();

  return <UserSecurityView model={model} />;
}

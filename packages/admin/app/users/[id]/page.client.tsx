import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactElement } from 'react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import Link from 'next/link';
import { AdminComponent } from '@/components/view/admin-component.client';
import { UserProfileHeader } from '@/app/users/[id]/components/view/user-profile-header.client';
import { UserProfileSidebar } from '@/app/users/[id]/components/view/user-profile-sidebar.client';
import { prop, state } from '@fromcode119/reactor';

export class UserProfilePage extends AdminComponent {
  @prop declare params: Promise<{ id: string }>;

  @state routeId = '';
  @state user: any = null;
  @state loading = true;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.routeId = params.id;
    void this.fetchUser();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchUser(): Promise<void> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USER(this.routeId));
      if (this.mounted) this.user = data;
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const id = this.routeId;
    const user = this.user;
    const loading = this.loading;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Synchronizing Identity..." />
        </div>
      );
    }

    if (!user) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-screen space-y-4">
          <h1 className="text-2xl font-semibold text-slate-400 tracking-tight">User Not Found</h1>
          <Link href={AdminConstants.ROUTES.USERS.LIST}>
            <Button variant={ButtonVariant.GHOST}>Return to Database</Button>
          </Link>
        </div>
      );
    }

    const initials = user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.email[0].toUpperCase();

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-700">
        <UserProfileHeader theme={theme} user={user} userId={id} initials={initials} />

        <div className="flex-1 w-full px-6 lg:px-12 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card title="Account Information">
                <div className="grid grid-cols-2 gap-8 py-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold tracking-tight text-slate-400 uppercase">First Name</span>
                    <p className={`font-bold ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>{user.firstName || 'Not Set'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold tracking-tight text-slate-400 uppercase">Last Name</span>
                    <p className={`font-bold ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>{user.lastName || 'Not Set'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold tracking-tight text-slate-400 uppercase">E-Mail Address</span>
                    <p className={`font-bold ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>{user.email}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold tracking-tight text-slate-400 uppercase">Username</span>
                    <p className={`font-bold ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>{user.username || 'Not Set'}</p>
                  </div>
                </div>
              </Card>

              <Card title="Assigned Security Roles" icon={<FrameworkIcons.Shield size={18} className="text-indigo-500" />}>
                 <div className="flex flex-wrap gap-3 py-2">
                   {user.roles && user.roles.length > 0 ? (
                      user.roles.map((role: string) => (
                        <div key={role} className={`px-6 py-4 rounded-xl border flex items-center gap-4 transition-all hover:border-indigo-500/50 hover:shadow-lg ${
                          theme === ThemeMode.DARK ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100 shadow-sm'
                        }`}>
                           <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                           <div>
                              <span className={`text-[11px] font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>{role}</span>
                              <p className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-tight">Custom Security Definition</p>
                           </div>
                        </div>
                      ))
                   ) : (
                      <p className="text-slate-500 font-bold text-sm italic py-4">No roles assigned to this account.</p>
                   )}
                 </div>
                 <div className="mt-8 pt-6 border-t border-slate-800/10 flex justify-end">
                    <Link href={AdminConstants.ROUTES.USERS.ROLES(id)}>
                      <Button variant={ButtonVariant.GHOST} className="text-[10px] font-bold tracking-tight text-indigo-500 uppercase">
                        Manage Assignments
                      </Button>
                    </Link>
                 </div>
              </Card>
            </div>

            <UserProfileSidebar user={user} theme={theme} />
          </div>
        </div>
      </div>
    );
  }
}

import type { FormEvent } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IRecordsHubItem } from '@fromcode119/react';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import { bound } from '@fromcode119/react-class-components';
import { PersonEditPageState } from '@/app/users/people/[id]/page-state.client';

/**
 * What can be done to a person: save, grant them a login, send a reset, reassign their records, and
 * delete them.
 *
 * Deleting is offered only alongside reassignment, because a person's records outlive the person —
 * removing the row without saying where its records go is how a shop loses the owner of its orders.
 */
export abstract class PersonEditPageActions extends PersonEditPageState {
  protected async fetchPerson(): Promise<void> {
    try {
      const res = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERSON(this.routeId));
      const person: IPerson = res?.person;
      if (!this.mounted) return;
      this.person = person;
      this.fields = PersonEditPageState.toFields(person);
      this.loading = false;
      this.notFound = !person;
      void AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USERS)
        .then((u: any) => { if (this.mounted) this.users = Array.isArray(u?.docs) ? u.docs : (Array.isArray(u) ? u : []); })
        .catch(() => undefined);
    } catch (err: any) {
      if (this.mounted) {
        this.loading = false;
        this.loadError = err?.message || 'The person record could not be loaded.';
      }
    }
  }

  @bound
  async retryLoad(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    await this.fetchPerson();
  }

  protected async save(e?: FormEvent): Promise<void> {
    e?.preventDefault();
    this.saving = true;
    this.error = '';
    try {
      await AdminApi.patch(AdminConstants.ENDPOINTS.SYSTEM.PERSON_SAVE(this.routeId), this.fields);
      this.router?.push(AdminConstants.ROUTES.PEOPLE.ROOT);
    } catch (err: any) {
      this.error = String(err?.message || 'Failed to save person');
      this.saving = false;
    }
  }

  protected async grantLogin(): Promise<void> {
    const person = this.person;
    if (!person?.email) return;
    this.granting = true;
    this.error = '';
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.PERSON_CREATE_USER(this.routeId), {
        email: person.email, firstName: person.firstName, lastName: person.lastName,
      });
      await this.fetchPerson();
    } catch (err: any) {
      this.error = String(err?.message || 'Failed to create login account');
    } finally {
      this.granting = false;
    }
  }

  /** Admin-trigger: (re)send the linked user a password-reset / set-password email. */
  protected async sendPasswordReset(): Promise<void> {
    const userId = this.person?.userId;
    if (userId == null || userId === '') return;
    this.sendingReset = true;
    this.error = '';
    this.notice = '';
    try {
      const res: any = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.ADMIN_SEND_PASSWORD_RESET, { userId });
      this.sendingReset = false;
      this.notice = res?.emailSent === false
        ? 'Reset link generated, but the email could not be sent — check SMTP settings.'
        : `Password reset email sent to ${res?.email || this.person?.email || 'the user'}.`;
    } catch (err: any) {
      this.sendingReset = false;
      this.error = String(err?.message || 'Failed to send password reset email');
    }
  }

  /** Delete this person (the linked login account, if any, is kept). */
  protected async remove(): Promise<void> {
    this.deleting = true;
    this.error = '';
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.PERSON(this.routeId));
      this.router?.push(AdminConstants.ROUTES.PEOPLE.ROOT);
    } catch (err: any) {
      this.deleting = false;
      this.confirmDelete = false;
      this.error = String(err?.message || 'Failed to delete person');
    }
  }

  /** Reassign (or clear, when reassignTo === '__none__') the linked login account. */
  protected async reassign(): Promise<void> {
    const userId = this.reassignTo === '__none__' ? null : this.reassignTo;
    this.reassigning = true;
    this.error = '';
    this.notice = '';
    try {
      await AdminApi.post(`${AdminConstants.ENDPOINTS.SYSTEM.PERSON(this.routeId)}/link-user`, { userId });
      this.reassigning = false;
      this.reassignOpen = false;
      this.notice = userId ? 'Login account reassigned.' : 'Login account unlinked.';
      await this.fetchPerson();
    } catch (err: any) {
      this.reassigning = false;
      this.error = String(err?.message || 'Failed to reassign the login account');
    }
  }

  /** Open a hub record: navigate to its admin page (href) or download its document (downloadUrl). */
  protected async openRecord(item: IRecordsHubItem): Promise<void> {
    if (item.downloadUrl) {
      try {
        const res: any = await AdminApi.get(item.downloadUrl);
        const base64 = String(res?.base64 ?? res?.file?.base64 ?? '');
        if (base64) {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: res?.mimeType || 'application/pdf' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = String(res?.filename || res?.fileName || `${item.title}.pdf`);
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          return;
        }
        if (res?.url) { window.open(String(res.url), '_blank', 'noopener'); return; }
      } catch { /* fall through to href */ }
    }
    if (item.href) {
      if (/^https?:\/\//i.test(item.href)) window.open(item.href, '_blank', 'noopener');
      else this.router?.push(item.href);
    }
  }
}

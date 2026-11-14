import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import { PeopleListFilter } from '@/app/users/people/enums/people-list-filter.enum';

/**
 * One person on the people list, on one line like a user or a plugin: name and whether they can sign
 * in, email and phone under it, where they came from and when, then the actions.
 */
export class PeopleRow extends PureReactor {
  @prop declare person: IPerson;
  @prop declare name: string;
  /** Where the person came from (an order, a form, a contact) — the record's own `source`. */
  @prop declare source: string;
  @prop declare onEdit: () => void;
  @prop declare onGrantLogin: () => void;

  render(): ReactNode {
    const { person } = this;
    const pill = AdminClass.of('ext-pill');
    const hasLogin = PeopleListFilter.hasLogin(person);
    const contact = [person.email, person.phone].filter(Boolean).join(' · ');
    const added = person.createdAt ? new Date(person.createdAt).toLocaleDateString() : '';
    const meta = [this.source, added].filter(Boolean).join(' · ');
    return (
      <div className={AdminClass.of('ext-row')}>
        <div className={`${AdminClass.of('ext-row__icon')} ${AdminClass.of('ext-row__icon--person')}`} aria-hidden="true">
          {(this.name[0] || '?').toUpperCase()}
        </div>
        <div className={AdminClass.of('ext-row__text')}>
          <div className={AdminClass.of('ext-row__name')}>
            <button type="button" className={AdminClass.of('ext-row__link')} onClick={this.onEdit}>{this.name}</button>
            {hasLogin
              ? <span className={`${pill} ${AdminClass.of('ext-pill--ok')}`}>{AdminI18n.t('users.linkedToUser', { id: person.userId })}</span>
              : <span className={pill}>{AdminI18n.t('users.noAccount')}</span>}
          </div>
          <p className={AdminClass.of('ext-row__desc')} title={contact}>{contact || '—'}</p>
        </div>
        <div className={AdminClass.of('ext-row__meta')} title={meta}>{meta}</div>
        <div className={AdminClass.of('ext-row__actions')}>
          {hasLogin ? null : (
            <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Plus size={14} />} onClick={this.onGrantLogin} disabled={!person.email}>
              {AdminI18n.t('users.createLoginAccount')}
            </Button>
          )}
        </div>
      </div>
    );
  }
}

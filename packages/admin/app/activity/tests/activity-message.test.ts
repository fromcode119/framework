import { ActivityMessage } from '@/app/activity/activity-message';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The console's own history was written as English sentences, so a Bulgarian console listed it in
 * English and each sentence repeated the actor standing in the column beside it. An entry names its
 * event now; rows written before it still read from the sentence they were stored with.
 */
describe('ActivityMessage', () => {
  it('says the event in the console own words when the entry names one', () => {
    const said = ActivityMessage.of({ message: 'Successful login for a@b.c', context: { event: 'auth.login.success', email: 'a@b.c' } });
    expect(said).toBe(AdminI18n.t('activity.events.auth.login.success'));
    expect(said).not.toContain('a@b.c');
  });

  it('keeps the sentence an older entry was stored with', () => {
    expect(ActivityMessage.of({ message: 'Something that happened', context: { userId: 7 } }))
      .toBe('Something that happened');
  });

  it('keeps the sentence when the event has no words yet', () => {
    expect(ActivityMessage.of({ message: 'Raw text', context: { event: 'plugin.did.something' } }))
      .toBe('Raw text');
  });
});

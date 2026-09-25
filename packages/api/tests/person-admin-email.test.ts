import { describe, expect, it, vi } from 'vitest';
import { PeopleManagementService } from '@api/services/people-management-service';

function service(people: Array<Record<string, any>>) {
  const update = vi.fn(async (_t: string, where: any, data: any) => Object.assign(people.find((p) => p.id === where.id) as any, data));
  const db = {
    findOne: vi.fn(async (_t: string, where: any) => people.find((p) => Object.entries(where).every(([k, v]) => p[k] === v)) ?? null),
    update,
  };
  return { svc: new PeopleManagementService(db, {} as any), update };
}

describe('Admin gives a person an email', () => {
  it('sets the email of a person who has none — so a login account can then be created', async () => {
    const people: any[] = [{ id: 7, first_name: 'Пенка', email: null, user_id: null }];
    const { svc } = service(people);
    const saved = await svc.savePerson(7, { firstName: 'Пенка', email: '  Penka@Example.BG ' });
    expect(saved.email).toBe('penka@example.bg');
  });

  it('refuses an invalid address, and one another person already has', async () => {
    const people: any[] = [{ id: 7, email: null, user_id: null }, { id: 8, email: 'taken@example.bg', user_id: null }];
    const { svc, update } = service(people);
    await expect(svc.savePerson(7, { email: 'not-an-email' })).rejects.toThrow(/valid email/);
    await expect(svc.savePerson(7, { email: 'taken@example.bg' })).rejects.toThrow(/#8/);
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves the email of a person with a login account to that account', async () => {
    const people: any[] = [{ id: 7, email: 'a@example.bg', user_id: 3 }];
    const { svc } = service(people);
    await expect(svc.savePerson(7, { email: 'b@example.bg' })).rejects.toThrow(/login account/);
    // Unchanged (the editor always sends it) is not a change.
    await expect(svc.savePerson(7, { firstName: 'A', email: 'A@example.bg' })).resolves.toBeTruthy();
  });
});

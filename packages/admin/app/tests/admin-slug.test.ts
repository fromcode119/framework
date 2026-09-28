import { describe, expect, it } from 'vitest';
import { AdminSlug } from '@/lib/i18n/admin-slug';

/** A slug from a title in the title's own script, by the rules its language ships. */
describe('AdminSlug', () => {
  it('transliterates Bulgarian by the official system, word endings included', () => {
    expect(AdminSlug.fromTitle('Тестов курс', 'bg')).toBe('testov-kurs');
    expect(AdminSlug.fromTitle('Щастие и жълт чай', 'bg')).toBe('shtastie-i-zhalt-chay');
    expect(AdminSlug.fromTitle('София, Пловдив', 'bg')).toBe('sofia-plovdiv');
    expect(AdminSlug.fromTitle('Юлия Ясенова', 'bg')).toBe('yulia-yasenova');
  });

  it('finds the table from the letters when the editing locale has none', () => {
    expect(AdminSlug.fromTitle('Тестов курс', 'en')).toBe('testov-kurs');
  });

  it('leaves Latin titles as they were', () => {
    expect(AdminSlug.fromTitle('Test Course 2', 'bg')).toBe('test-course-2');
    expect(AdminSlug.fromTitle('Crème brûlée', 'en')).toBe('creme-brulee');
  });

  it('gives no slug for a script no shipped language can spell, rather than inventing "item"', () => {
    expect(AdminSlug.fromTitle('東京', 'en')).toBe('');
  });
});

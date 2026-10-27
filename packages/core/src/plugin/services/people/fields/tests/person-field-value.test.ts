import { describe, expect, it } from 'vitest';
import { PersonFieldType } from '@core/plugin/services/people/fields/enums/person-field-type.enum';
import { PersonFieldValue } from '@core/plugin/services/people/fields/person-field-value';
import { PersonFieldValueError } from '@core/plugin/services/people/fields/person-field-value-error';

describe('PersonFieldValue', () => {
  const normalize = (type: PersonFieldType, raw: unknown, options: string[] = []) => PersonFieldValue.normalize('field', type, raw, options);

  it('stores nothing for an empty answer of any type', () => {
    for (const type of PersonFieldType.values()) {
      expect(normalize(type, '')).toBeNull();
      expect(normalize(type, null)).toBeNull();
    }
  });

  it('trims text and refuses text longer than its type allows', () => {
    expect(normalize(PersonFieldType.TEXT, '  Maria Ivanova ')).toBe('Maria Ivanova');
    expect(() => normalize(PersonFieldType.TEXT, 'x'.repeat(501))).toThrow(PersonFieldValueError);
    expect(normalize(PersonFieldType.LONG_TEXT, 'x'.repeat(501))).toHaveLength(501);
  });

  it('accepts only real calendar dates', () => {
    expect(normalize(PersonFieldType.DATE, '1990-02-28')).toBe('1990-02-28');
    expect(() => normalize(PersonFieldType.DATE, '1990-02-30')).toThrow(PersonFieldValueError);
    expect(() => normalize(PersonFieldType.DATE, '28.02.1990')).toThrow(PersonFieldValueError);
  });

  it('accepts a 24-hour time only', () => {
    expect(normalize(PersonFieldType.TIME, '07:45')).toBe('07:45');
    expect(() => normalize(PersonFieldType.TIME, '24:00')).toThrow(PersonFieldValueError);
  });

  it('keeps numbers and booleans as their own types', () => {
    expect(normalize(PersonFieldType.NUMBER, '42.5')).toBe(42.5);
    expect(() => normalize(PersonFieldType.NUMBER, 'many')).toThrow(PersonFieldValueError);
    expect(normalize(PersonFieldType.BOOLEAN, false)).toBe(false);
    expect(() => normalize(PersonFieldType.BOOLEAN, 'true')).toThrow(PersonFieldValueError);
  });

  it('allows only the field options for a choice', () => {
    expect(normalize(PersonFieldType.CHOICE, 'calm', ['calm', 'bold'])).toBe('calm');
    expect(() => normalize(PersonFieldType.CHOICE, 'loud', ['calm', 'bold'])).toThrow(PersonFieldValueError);
    expect(normalize(PersonFieldType.CHOICES, ['bold', 'calm', 'bold'], ['calm', 'bold'])).toEqual(['bold', 'calm']);
    expect(normalize(PersonFieldType.CHOICES, [], ['calm'])).toBeNull();
    expect(() => normalize(PersonFieldType.CHOICES, 'calm', ['calm'])).toThrow(PersonFieldValueError);
  });
});

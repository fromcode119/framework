import { describe, expect, it } from 'vitest';
import { AuthProfileService } from '../src/services/auth-profile-service';

describe('AuthProfileService', () => {
  it('round-trips generic extra profile fields without naming them in framework code', () => {
    const payload = AuthProfileService.sanitizeProfilePayload({
      phone: '12345',
      birthdate: '1990-05-11',
      numerologyFocus: 'life-path',
    });

    expect(payload).toMatchObject({
      phone: '12345',
      birthdate: '1990-05-11',
      numerologyFocus: 'life-path',
    });
  });

  it('ignores nested extra fields and invalid keys', () => {
    const payload = AuthProfileService.sanitizeProfilePayload({
      birthdate: '1990-05-11',
      'bad-key': 'x',
      nested: { no: 'thanks' },
    } as any);

    expect(payload.birthdate).toBe('1990-05-11');
    expect(payload['bad-key']).toBeUndefined();
    expect(payload.nested).toBeUndefined();
  });

  it('parses stored profile metadata with extra scalar fields', () => {
    const parsed = AuthProfileService.parseStoredProfile(JSON.stringify({
      phone: '12345',
      birthdate: '1990-05-11',
    }));

    expect(parsed.phone).toBe('12345');
    expect(parsed.birthdate).toBe('1990-05-11');
  });

  it('treats first and last name as user-core fields rather than profile-meta fields', () => {
    const payload = AuthProfileService.sanitizeProfilePayload({
      firstName: 'Kristian',
      lastName: 'Dimitrov',
      phone: '12345',
      city: 'Sofia',
    });

    expect(AuthProfileService.extractUserNameFields(payload)).toEqual({
      firstName: 'Kristian',
      lastName: 'Dimitrov',
    });

    expect(AuthProfileService.stripUserNameFields(payload)).toEqual({
      phone: '12345',
      city: 'Sofia',
    });
  });
});

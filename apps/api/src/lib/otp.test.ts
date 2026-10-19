import { describe, expect, it } from 'vitest';
import { generateOtpCode, hashOtp, hashToken, verifyOtp } from './otp';

describe('OTP', () => {
  it('genera códigos de 6 dígitos', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it('verifica el código correcto y rechaza el incorrecto', () => {
    const stored = hashOtp('123456');
    expect(verifyOtp('123456', stored)).toBe(true);
    expect(verifyOtp('654321', stored)).toBe(false);
  });

  it('usa sal distinta en cada hash', () => {
    expect(hashOtp('123456')).not.toBe(hashOtp('123456'));
  });

  it('hashea tokens de refresh de forma estable', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

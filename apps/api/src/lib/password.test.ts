import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('contraseñas', () => {
  it('hashea y verifica la contraseña correcta', () => {
    const stored = hashPassword('Secreta123');
    expect(verifyPassword('Secreta123', stored)).toBe(true);
    expect(verifyPassword('Secreta124', stored)).toBe(false);
  });

  it('usa sal distinta en cada hash', () => {
    expect(hashPassword('Secreta123')).not.toBe(hashPassword('Secreta123'));
  });

  it('rechaza hashes nulos o corruptos', () => {
    expect(verifyPassword('Secreta123', null)).toBe(false);
    expect(verifyPassword('Secreta123', 'otro-formato')).toBe(false);
    expect(verifyPassword('Secreta123', 'scrypt$x$8$1$aa$bb')).toBe(false);
  });
});

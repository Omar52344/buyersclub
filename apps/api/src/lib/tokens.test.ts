import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './tokens';

describe('tokens de acceso', () => {
  it('firma y verifica un token con el id del usuario', async () => {
    const userId = '6f1c2f44-6f1a-4f5f-9d4e-6a3f0f3c9b11';
    const token = await signAccessToken(userId);
    await expect(verifyAccessToken(token)).resolves.toBe(userId);
  });

  it('rechaza un token manipulado', async () => {
    const token = await signAccessToken('usuario');
    await expect(verifyAccessToken(`${token}x`)).rejects.toThrow();
  });

  it('rechaza un token que no es de acceso', async () => {
    await expect(verifyAccessToken('no-es-un-jwt')).rejects.toThrow();
  });
});

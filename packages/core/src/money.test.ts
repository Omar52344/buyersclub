import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, fromMajorUnits, money, sumMoney } from './money';

describe('money', () => {
  it('convierte pesos a centavos sin decimales flotantes', () => {
    expect(fromMajorUnits(12500, 'COP')).toEqual({ amountCents: 1_250_000, currency: 'COP' });
    expect(fromMajorUnits(12.34, 'USD')).toEqual({ amountCents: 1234, currency: 'USD' });
  });

  it('suma montos de la misma moneda', () => {
    const total = addMoney(money(1_500_000, 'COP'), money(2_000_000, 'COP'));
    expect(total.amountCents).toBe(3_500_000);
  });

  it('rechaza mezclar monedas', () => {
    expect(() => sumMoney([money(100, 'COP'), money(100, 'USD')])).toThrow(/sin conversión/);
  });

  it('formatea COP sin decimales y USD con dos', () => {
    expect(formatMoney(money(1_250_000, 'COP'))).toContain('12.500');
    expect(formatMoney(money(1234, 'USD'))).toContain('12.34');
  });

  it('rechaza montos no enteros', () => {
    expect(() => money(10.5, 'COP')).toThrow(RangeError);
  });
});

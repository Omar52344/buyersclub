import { describe, expect, it } from 'vitest';
import { canTransition, isFinalStatus, nextStatuses } from './order-status';

describe('máquina de estados del pedido', () => {
  it('el vendedor acepta un pedido pendiente', () => {
    expect(canTransition('pending', 'accepted', 'vendor')).toBe(true);
  });

  it('el comprador no puede aceptar su propio pedido', () => {
    expect(canTransition('pending', 'accepted', 'buyer')).toBe(false);
  });

  it('el comprador solo cancela mientras está pendiente o esperando pago', () => {
    expect(canTransition('pending', 'cancelled', 'buyer')).toBe(true);
    expect(canTransition('awaiting_payment', 'cancelled', 'buyer')).toBe(true);
    expect(canTransition('preparing', 'cancelled', 'buyer')).toBe(false);
  });

  it('no se puede salir de un estado final', () => {
    expect(isFinalStatus('completed')).toBe(true);
    expect(canTransition('completed', 'cancelled', 'vendor')).toBe(false);
  });

  it('en preparación el vendedor elige recogida o domicilio', () => {
    expect(nextStatuses('preparing', 'vendor')).toEqual(['ready', 'out_for_delivery', 'rejected']);
  });
});

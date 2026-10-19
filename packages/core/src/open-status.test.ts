import { describe, expect, it } from 'vitest';
import { computeOpenStatus, getLocalParts } from './open-status';

const monday10amBogota = new Date('2026-01-05T15:00:00Z');

const base = {
  at: monday10amBogota,
  timeZone: 'America/Bogota',
  status: 'active',
  manualOpen: true,
  hours: [{ weekday: 1, opensAt: '08:00', closesAt: '18:00' }],
  exceptions: [],
};

describe('estado abierto/cerrado', () => {
  it('convierte a la zona horaria de la sucursal', () => {
    const local = getLocalParts(monday10amBogota, 'America/Bogota');
    expect(local.date).toBe('2026-01-05');
    expect(local.weekday).toBe(1);
    expect(local.time).toBe('10:00');
  });

  it('abre dentro del horario', () => {
    expect(computeOpenStatus(base)).toMatchObject({ isOpen: true, reason: 'open' });
  });

  it('cierra el interruptor manual aunque esté en horario', () => {
    expect(computeOpenStatus({ ...base, manualOpen: false })).toMatchObject({
      isOpen: false,
      reason: 'manual_closed',
    });
  });

  it('cierra fuera del horario', () => {
    expect(computeOpenStatus({ ...base, at: new Date('2026-01-05T23:30:00Z') })).toMatchObject({
      isOpen: false,
      reason: 'outside_hours',
    });
  });

  it('una excepción cerrada gana sobre el horario', () => {
    expect(
      computeOpenStatus({
        ...base,
        exceptions: [{ date: '2026-01-05', isClosed: true }],
      }),
    ).toMatchObject({ isOpen: false, reason: 'exception_closed' });
  });

  it('sin horario para el día está cerrado', () => {
    expect(computeOpenStatus({ ...base, hours: [] })).toMatchObject({
      isOpen: false,
      reason: 'no_schedule',
    });
  });
});

import { CURRENCY_INFO, type Currency } from './currency';

/**
 * Monto monetario inmutable.
 *
 * `amountCents` siempre se guarda en centavos (2 decimales) para todas las
 * monedas, aunque COP se muestre sin decimales. Así la aritmética es entera y
 * no hay errores de punto flotante.
 */
export interface Money {
  readonly amountCents: number;
  readonly currency: Currency;
}

export function money(amountCents: number, currency: Currency): Money {
  if (!Number.isSafeInteger(amountCents)) {
    throw new RangeError('amountCents debe ser un entero seguro (sin decimales).');
  }
  return { amountCents, currency };
}

export function toMajorUnits(value: Money): number {
  return value.amountCents / 100;
}

export function fromMajorUnits(amount: number, currency: Currency): Money {
  if (!Number.isFinite(amount)) {
    throw new RangeError('El monto debe ser un número finito.');
  }
  return money(Math.round(amount * 100), currency);
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`No se pueden operar montos en ${a.currency} y ${b.currency} sin conversión.`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountCents + b.amountCents, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountCents - b.amountCents, a.currency);
}

export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity)) {
    throw new RangeError('La cantidad debe ser un entero.');
  }
  return money(value.amountCents * quantity, value.currency);
}

export function sumMoney(items: readonly Money[], fallbackCurrency: Currency = 'COP'): Money {
  const first = items[0];
  if (!first) {
    return money(0, fallbackCurrency);
  }
  return items.reduce((total, item) => addMoney(total, item), money(0, first.currency));
}

export function formatMoney(value: Money): string {
  const info = CURRENCY_INFO[value.currency];
  return new Intl.NumberFormat(info.locale, {
    style: 'currency',
    currency: value.currency,
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  }).format(toMajorUnits(value));
}

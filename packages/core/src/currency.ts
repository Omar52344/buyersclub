export const CURRENCIES = ['COP', 'USD'] as const;

export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'COP';

export interface CurrencyInfo {
  readonly code: Currency;
  readonly symbol: string;
  readonly locale: string;
  /** Decimales que se muestran al formatear (los montos se guardan en centavos). */
  readonly decimals: number;
}

export const CURRENCY_INFO: Record<Currency, CurrencyInfo> = {
  COP: { code: 'COP', symbol: '$', locale: 'es-CO', decimals: 0 },
  USD: { code: 'USD', symbol: 'US$', locale: 'en-US', decimals: 2 },
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

export function assertCurrency(value: unknown): Currency {
  if (!isCurrency(value)) {
    throw new Error(`Moneda no soportada: ${String(value)}. Use ${CURRENCIES.join(' o ')}.`);
  }
  return value;
}

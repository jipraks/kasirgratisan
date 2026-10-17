/**
 * Single currency for the whole app: Colombian peso (COP).
 * Amounts are stored as integer pesos (no decimals).
 */
export const CURRENCY_CODE = 'COP';
export const CURRENCY_SYMBOL = '$';
/** Locale used for every number shown in the app (thousands ".", decimals ","). */
export const NUMBER_LOCALE = 'es-CO';

export const formatNumber = (n: number): string => n.toLocaleString(NUMBER_LOCALE);

/** Formats an amount as "$ 15.000". */
export const formatCurrency = (n: number): string => `${CURRENCY_SYMBOL} ${formatNumber(n)}`;

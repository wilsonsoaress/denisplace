import { Prisma } from '@prisma/client';

export const Decimal = Prisma.Decimal;
export type Money = Prisma.Decimal;

/**
 * Dinheiro no sistema inteiro passa por aqui. `number`/float nunca representa
 * valor monetario: 0.1 + 0.2 nao e 0.3 e isso aparece em multa, juros e reajuste.
 */
export function D(value: string | number | Money | null | undefined): Money {
  if (value === null || value === undefined) return Decimal(0);
  if (Decimal.isDecimal(value)) return value;
  // number so e aceito vindo de fonte ja arredondada; entrada humana vem como string.
  return Decimal(String(value));
}

/** Arredondamento comercial: 2 casas, meio para cima. */
export function money(value: Money): Money {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sum(...values: Array<Money | number | string | null | undefined>): Money {
  return values.reduce<Money>((acc, v) => acc.plus(D(v)), Decimal(0));
}

export function pct(base: Money, percentual: Money | string | number): Money {
  return base.times(D(percentual)).div(100);
}

export function isZero(value: Money): boolean {
  return value.isZero();
}

export function gte(a: Money, b: Money): boolean {
  return a.gte(b);
}

const BRL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function brl(value: Money | number | string | null | undefined): string {
  return `R$ ${BRL.format(D(value).toNumber())}`;
}

/** Percentual para exibicao: 4,31 -> "4,31%". */
export function brlPct(value: Money | number | string | null | undefined, casas = 2): string {
  const n = D(value).toNumber();
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

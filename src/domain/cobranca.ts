import { Decimal, money, type Money, D } from './money';
import { diffDays, type DateISO } from './dates';

/**
 * Regras de atraso do contrato de locacao. Ficam em um unico lugar porque
 * dashboard, contas a receber e matriz precisam do MESMO numero — divergencia
 * entre as tres telas e o que destrói a confianca em substituir a planilha.
 */
export const MULTA_ATRASO_PCT = D(2); // 2% sobre o valor original
export const JUROS_AO_MES_PCT = D(1); // 1% ao mes, prorrata por dia corrido
export const DIAS_NO_MES = D(30);

export type Situacao = 'pago' | 'vencido' | 'aberto' | 'isento';

export function diasAtraso(vencimento: DateISO, hoje: DateISO): number {
  const d = diffDays(vencimento, hoje);
  return d > 0 ? d : 0;
}

/**
 * Multa + juros sobre um titulo vencido.
 * Dia 1 de atraso ja paga multa cheia de 2% e juros proporcionais.
 */
export function acrescimos(valorOriginal: Money, dias: number): Money {
  if (dias <= 0) return D(0);
  const multa = valorOriginal.times(MULTA_ATRASO_PCT).div(100);
  const juros = valorOriginal.times(JUROS_AO_MES_PCT).div(100).times(D(dias)).div(DIAS_NO_MES);
  return money(multa.plus(juros));
}

export function situacaoTitulo(input: {
  pago: boolean;
  isento: boolean;
  vencimento: DateISO;
  hoje: DateISO;
}): Situacao {
  if (input.pago) return 'pago';
  if (input.isento) return 'isento';
  return diasAtraso(input.vencimento, input.hoje) > 0 ? 'vencido' : 'aberto';
}

export function totalDevido(input: {
  valorOriginal: Money;
  pago: boolean;
  isento: boolean;
  vencimento: DateISO;
  hoje: DateISO;
}): Money {
  const s = situacaoTitulo(input);
  if (s === 'pago') return money(input.valorOriginal);
  if (s === 'aberto' || s === 'isento') return money(input.valorOriginal);
  return money(input.valorOriginal.plus(acrescimos(input.valorOriginal, diasAtraso(input.vencimento, input.hoje))));
}

/**
 * Quanto o titulo custaria se fosse pago naquela data. Os acrescimos param de
 * correr na data do pagamento: quem quitou no dia 15 nao passa a dever mais
 * so porque a tela foi aberta no dia 24.
 */
export function devidoNaData(valorOriginal: Money, vencimento: DateISO, data: DateISO): Money {
  return money(valorOriginal.plus(acrescimos(valorOriginal, diasAtraso(vencimento, data))));
}

/** Pagamento valido para a conta de quitacao: os anulados ficam de fora (a borda filtra). */
export type PagamentoResumo = { valor: Money; data: DateISO };

/**
 * Regra unica de quitacao, usada pelo cadastro de pagamento e pelo estorno.
 * Devolve tambem o saldo, para a tela falar o mesmo numero que o banco.
 */
export function estadoQuitacao(input: {
  valorOriginal: Money;
  vencimento: DateISO;
  pagamentos: PagamentoResumo[];
  hoje: DateISO;
}): { pago: boolean; saldo: Money; devidoNaUltimaData: Money | null } {
  const pagos = input.pagamentos.filter((p) => !p.valor.isZero());
  const soma = pagos.reduce<Money>((acc, p) => acc.plus(p.valor), D(0));
  const ultima = pagos.reduce<DateISO | null>(
    (acc, p) => (acc === null || p.data > acc ? p.data : acc),
    null,
  );

  if (ultima !== null && money(soma).gte(devidoNaData(input.valorOriginal, input.vencimento, ultima))) {
    return { pago: true, saldo: D(0), devidoNaUltimaData: devidoNaData(input.valorOriginal, input.vencimento, ultima) };
  }
  const devidoHoje = devidoNaData(input.valorOriginal, input.vencimento, input.hoje);
  const saldo = money(devidoHoje.minus(soma));
  return { pago: false, saldo: saldo.isNegative() ? D(0) : saldo, devidoNaUltimaData: ultima === null ? null : devidoNaData(input.valorOriginal, input.vencimento, ultima) };
}

/**
 * Isento por convenio fica FORA do numerador e do denominador da adimplencia.
 * Contar isento como "não pago" faria o indice cair sem ninguem ter atrasado.
 */
export function adimplenciaPorValor(recebido: Money, vencido: Money): number | null {
  const base = recebido.plus(vencido);
  if (base.isZero()) return null;
  return recebido.div(base).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export const SITUACAO_LABEL: Record<Situacao, string> = {
  pago: 'paga',
  vencido: 'vencida',
  aberto: 'aberta',
  isento: 'isenta',
};

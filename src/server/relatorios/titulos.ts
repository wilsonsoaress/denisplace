import { Prisma, type EscopoCobranca, type FormaPagamento } from '@prisma/client';
import { prisma } from '../db';
import { D, money, type Money } from '@/domain/money';
import { competencia, fimDaCompetencia, hoje, toISO, type Competencia, type DateISO } from '@/domain/dates';
import {
  acrescimos,
  diasAtraso,
  estadoQuitacao,
  situacaoTitulo,
  type PagamentoResumo,
  type Situacao,
} from '@/domain/cobranca';

/**
 * Fonte unica do "quanto deve" de um titulo. Grade de contas a receber, dashboard
 * e matriz de inadimplencia importam daqui: se alguma das tres calculasse saldo por
 * conta propria, a divergencia entre telas destruiria a confianca no sistema.
 */

export type Linha = {
  id: string;
  numero: string;
  contratoId: string;
  contratoNumero: number;
  devedor: string;
  condominio: string | null;
  condominioId: string | null;
  escopo: EscopoCobranca;
  comp: Competencia;
  vencimento: DateISO;
  valorOriginal: Money;
  situacao: Situacao;
  dias: number;
  acr: Money;
  recebido: Money;
  saldo: Money | null;
  boletoGerado: boolean;
  nossoNumero: string | null;
  nfEmitida: boolean;
  nfNumero: string | null;
  pagoEm: DateISO | null;
  forma: FormaPagamento | null;
  semComprovante: boolean;
  isentoMotivo: string | null;
};

export type TituloComPagamentos = Prisma.TituloGetPayload<{
  include: {
    pagamentos: true;
    contrato: { select: { id: true; numero: true; condominioId: true } };
  };
}>;

export function linhaDeTitulo(t: TituloComPagamentos, hojeStr: DateISO): Linha {
  const valorOriginal = money(D(t.valorOriginal));
  const vencimento = toISO(t.vencimento) as DateISO;
  const pagamentos = t.pagamentos
    .filter((p) => !p.anulado)
    .map<PagamentoResumo>((p) => ({ valor: money(D(p.valor)), data: toISO(p.data) as DateISO }));

  const situacao = situacaoTitulo({ pago: t.pago, isento: t.isento, vencimento, hoje: hojeStr });
  const estado = estadoQuitacao({ valorOriginal, vencimento, pagamentos, hoje: hojeStr });
  const recebido = pagamentos.reduce<Money>((acc, p) => acc.plus(p.valor), D(0));
  const dias = situacao === 'vencido' ? diasAtraso(vencimento, hojeStr) : 0;
  // Pago: o acrescimo cobrado de fato e o que entrou a mais no recebimento.
  // Vencido: o acrescimo correto e o de hoje, sobre o valor original.
  const excesso = money(recebido.minus(valorOriginal));
  const acr =
    situacao === 'pago'
      ? excesso.lessThan(0)
        ? D(0)
        : excesso
      : situacao === 'vencido'
        ? acrescimos(valorOriginal, dias)
        : D(0);

  // Um titulo ja quitado nao volta a dever: os acrescimos congelaram na data do
  // pagamento, mesmo que o recibo da planilha antiga nao tenha incluido multa e juros.
  const saldo = t.pago ? D(0) : situacao === 'isento' ? null : estado.saldo;

  return {
    id: t.id,
    numero: t.numero,
    contratoId: t.contratoId,
    contratoNumero: t.contrato.numero,
    devedor: t.devedorNome,
    condominio: t.condominioNome,
    condominioId: t.contrato.condominioId,
    escopo: t.escopo,
    comp: competencia(toISO(t.competencia) as DateISO) as Competencia,
    vencimento,
    valorOriginal,
    situacao,
    dias,
    acr,
    recebido,
    saldo,
    boletoGerado: t.boletoGerado,
    nossoNumero: t.nossoNumero,
    nfEmitida: t.nfEmitida,
    nfNumero: t.nfNumero,
    pagoEm: toISO(t.pagoEm),
    forma: t.forma,
    semComprovante:
      t.pago && t.pagamentos.filter((p) => !p.anulado).every((p) => !p.comprovanteUrl),
    isentoMotivo: t.isentoMotivo,
  };
}

export const CHIP_SITUACAO: Record<Situacao, string> = {
  pago: 'chip chip-ok',
  vencido: 'chip chip-bad',
  aberto: 'chip chip-warn',
  isento: 'chip chip-free',
};

export type FiltroRelatorio = {
  de: Competencia;
  ate: Competencia;
  condominioId?: string | null;
  escopo?: EscopoCobranca | null;
};

/** Titulos do intervalo de competencias, ja convertidos em linha com saldo. */
export async function titulosDoPeriodo(f: FiltroRelatorio): Promise<Linha[]> {
  const hojeStr = hoje();
  const titulos = await prisma.titulo.findMany({
    where: {
      competencia: { gte: new Date(`${f.de}T00:00:00.000Z`), lte: new Date(`${fimDaCompetencia(f.ate)}T00:00:00.000Z`) },
      ...(f.condominioId ? { contrato: { condominioId: f.condominioId } } : {}),
      ...(f.escopo ? { escopo: f.escopo } : {}),
    },
    include: { pagamentos: true, contrato: { select: { id: true, numero: true, condominioId: true } } },
    orderBy: [{ competencia: 'asc' }, { numero: 'asc' }],
  });
  return titulos.map((t) => linhaDeTitulo(t, hojeStr));
}

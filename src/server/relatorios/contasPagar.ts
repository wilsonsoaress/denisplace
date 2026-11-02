import { Prisma, type CategoriaContaPagar, type FormaPagamento } from '@prisma/client';
import { prisma } from '../db';
import { D, money, type Money } from '@/domain/money';
import { competencia, fimDaCompetencia, hoje, toISO, type Competencia, type DateISO } from '@/domain/dates';
import { acrescimos, diasAtraso, estadoQuitacao, situacaoTitulo, type PagamentoResumo, type Situacao } from '@/domain/cobranca';

/**
 * Fonte unica do "quanto se deve" de um lancamento a pagar. Mesma logica do
 * contas a receber (`@/server/relatorios/titulos`): se a grade calculasse saldo
 * por conta propria, divergiria do dashboard e da tela de detalhe.
 *
 * Diferenca do titulo: multa/juros so corre quando `encargoPorAtraso` esta
 * ligado (nem todo fornecedor cobra atraso) — por isso `acr` some do calculo
 * quando a flag esta desligada, mesmo com o lancamento vencido.
 */

export type Linha = {
  id: string;
  numero: string;
  fornecedor: string;
  categoria: CategoriaContaPagar;
  descricao: string;
  comp: Competencia;
  vencimento: DateISO;
  valorOriginal: Money;
  situacao: Situacao;
  dias: number;
  acr: Money;
  pago: Money;
  saldo: Money;
  encargoPorAtraso: boolean;
  nfRecebida: boolean;
  nfNumero: string | null;
  pagoEm: DateISO | null;
  forma: FormaPagamento | null;
  recorrente: boolean;
  contratoId: string | null;
  contratoNumero: number | null;
  ordemServicoId: string | null;
  ordemServicoNumero: number | null;
};

export type ContaPagarComPagamentos = Prisma.ContaPagarGetPayload<{
  include: {
    pagamentos: true;
    contrato: { select: { id: true; numero: true } };
    ordemServico: { select: { id: true; numero: true } };
  };
}>;

export function linhaDeContaPagar(c: ContaPagarComPagamentos, hojeStr: DateISO): Linha {
  const valorOriginal = money(D(c.valorOriginal));
  const vencimento = toISO(c.vencimento) as DateISO;
  const pagamentos = c.pagamentos
    .filter((p) => !p.anulado)
    .map<PagamentoResumo>((p) => ({ valor: money(D(p.valor)), data: toISO(p.data) as DateISO }));

  // Sem `isento` no dominio dos lancamentos a pagar: a situacao e sempre
  // pago/vencido/aberto. Quem decide se o atraso pesa e `encargoPorAtraso`.
  const situacao = situacaoTitulo({ pago: c.pago, isento: false, vencimento, hoje: hojeStr });
  const dias = diasAtraso(vencimento, hojeStr);

  const pago = pagamentos.reduce<Money>((acc, p) => acc.plus(p.valor), D(0));
  const estado = c.encargoPorAtraso
    ? estadoQuitacao({ valorOriginal, vencimento, pagamentos, hoje: hojeStr })
    : { saldo: money(valorOriginal.minus(pago)) };

  const excesso = money(pago.minus(valorOriginal));
  const acr =
    situacao === 'pago'
      ? excesso.lessThan(0)
        ? D(0)
        : excesso
      : c.encargoPorAtraso && situacao === 'vencido'
        ? acrescimos(valorOriginal, dias)
        : D(0);

  const saldo = c.pago ? D(0) : estado.saldo.isNegative() ? D(0) : estado.saldo;

  return {
    id: c.id,
    numero: c.numero,
    fornecedor: c.fornecedorNome,
    categoria: c.categoria,
    descricao: c.descricao,
    comp: competencia(toISO(c.competencia) as DateISO) as Competencia,
    vencimento,
    valorOriginal,
    situacao,
    dias: situacao === 'vencido' ? dias : 0,
    acr,
    pago,
    saldo,
    encargoPorAtraso: c.encargoPorAtraso,
    nfRecebida: c.nfRecebida,
    nfNumero: c.nfNumero,
    pagoEm: toISO(c.pagoEm),
    forma: c.forma,
    recorrente: c.recorrente,
    contratoId: c.contratoId,
    contratoNumero: c.contrato?.numero ?? null,
    ordemServicoId: c.ordemServicoId,
    ordemServicoNumero: c.ordemServico?.numero ?? null,
  };
}

export type FiltroRelatorioPagar = { de: Competencia; ate: Competencia; contratoId?: string | null };

/** Lancamentos do intervalo de competencias, ja convertidos em linha com saldo. */
export async function contasPagarDoPeriodo(f: FiltroRelatorioPagar): Promise<Linha[]> {
  const hojeStr = hoje();
  const lancamentos = await prisma.contaPagar.findMany({
    where: {
      competencia: { gte: new Date(`${f.de}T00:00:00.000Z`), lte: new Date(`${fimDaCompetencia(f.ate)}T00:00:00.000Z`) },
      ...(f.contratoId ? { contratoId: f.contratoId } : {}),
    },
    include: {
      pagamentos: true,
      contrato: { select: { id: true, numero: true } },
      ordemServico: { select: { id: true, numero: true } },
    },
    orderBy: [{ competencia: 'asc' }, { numero: 'asc' }],
  });
  return lancamentos.map((c) => linhaDeContaPagar(c, hojeStr));
}

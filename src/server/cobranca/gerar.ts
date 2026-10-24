import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { D, money, sum, type Money } from '@/domain/money';
import { competencia as toCompetencia, vencimentoDaCompetencia, type Competencia, type DateISO } from '@/domain/dates';

export type ResultadoGeracao = {
  competencia: Competencia;
  criadas: number;
  jaExistiam: number;
  puladas: Array<{ contrato: number; motivo: string }>;
};

/**
 * Gera fatura + titulo de um contrato na competencia alvo.
 *
 * O preco efetivo vem do item vigente naquela competencia. Competencias passadas
 * ja faturadas tem o preco congelado em FaturaItem — e por isso ele existe: o
 * historico de cobranca nao pode mudar quando um aditivo entra depois.
 */
async function precosNaCompetencia(
  tx: Prisma.TransactionClient,
  contratoId: string,
  comp: Competencia,
): Promise<{ itens: Array<{ contratoItemId: string; descricao: string; quantidade: Money; precoUnitario: Money; total: Money }>; bruto: Money }> {
  const itens = await tx.contratoItem.findMany({ where: { contratoId, ativo: true } });
  const linha = itens
    .filter((i) => i.inicio.toISOString().slice(0, 7) <= comp.slice(0, 7))
    .filter((i) => !i.fim || i.fim.toISOString().slice(0, 10) >= comp)
    .map((i) => {
      const vigenteDesde = i.vigenciaDesde.toISOString().slice(0, 10);
      const precoUnitario = comp >= vigenteDesde ? D(i.precoAtual) : D(i.precoInicial);
      const quantidade = D(i.quantidade);
      return {
        contratoItemId: i.id,
        descricao: i.descricao,
        quantidade,
        precoUnitario,
        total: money(quantidade.times(precoUnitario)),
      };
    });

  return { itens: linha, bruto: sum(...linha.map((l) => l.total)) };
}

function estaVigente(status: string, inicio: DateISO, fim: DateISO | null, comp: Competencia): boolean {
  if (status !== 'VIGENTE') return false;
  const mesComp = comp.slice(0, 7);
  if (inicio.slice(0, 7) > mesComp) return false;
  if (fim && fim.slice(0, 7) < mesComp) return false;
  return true;
}

function numeroDoTitulo(contratoNumero: number, comp: Competencia): string {
  return `T${comp.slice(0, 4)}${comp.slice(5, 7)}-${String(contratoNumero).padStart(5, '0')}`;
}

/**
 * Job mensal. Idempotente por (contratoId, competencia): reprocessar o mes nao
 * duplica cobranca, e isso e o que permite rodar de novo depois de uma falha.
 */
export async function gerarCobranca(
  competencia: Competencia,
  opts: { contratoIds?: string[]; dryRun?: boolean } = {},
): Promise<ResultadoGeracao> {
  const comp = toCompetencia(competencia);
  const resultado: ResultadoGeracao = { competencia: comp, criadas: 0, jaExistiam: 0, puladas: [] };

  const contratos = await prisma.contrato.findMany({
    where: {
      status: 'VIGENTE',
      ...(opts.contratoIds?.length ? { id: { in: opts.contratoIds } } : {}),
    },
    include: {
      cliente: true,
      condominio: true,
      aderencias: {
        where: { desde: { lte: new Date(`${comp}T23:59:59.000Z`) } },
        include: { unidade: true, morador: true },
        orderBy: { desde: 'desc' },
        take: 1,
      },
    },
    orderBy: { numero: 'asc' },
  });

  for (const contrato of contratos) {
    const inicio = contrato.inicio.toISOString().slice(0, 10);
    const fim = contrato.fim ? contrato.fim.toISOString().slice(0, 10) : null;

    if (!estaVigente(contrato.status, inicio, fim, comp)) {
      resultado.puladas.push({ contrato: contrato.numero, motivo: 'fora da vigencia' });
      continue;
    }

    const existente = await prisma.fatura.findUnique({
      where: { contratoId_competencia: { contratoId: contrato.id, competencia: new Date(`${comp}T00:00:00.000Z`) } },
    });
    if (existente) {
      resultado.jaExistiam += 1;
      continue;
    }

    const { itens, bruto } = await precosNaCompetencia(prisma as unknown as Prisma.TransactionClient, contrato.id, comp);
    if (itens.length === 0) {
      resultado.puladas.push({ contrato: contrato.numero, motivo: 'sem item ativo na competencia' });
      continue;
    }
    if (bruto.isZero()) {
      resultado.puladas.push({ contrato: contrato.numero, motivo: 'valor bruto zero' });
      continue;
    }

    const desconto = money(bruto.times(D(contrato.descontoPct)).div(100));
    const liquido = money(bruto.minus(desconto));
    const vencimento = vencimentoDaCompetencia(comp, contrato.vencimentoDia);

    if (opts.dryRun) {
      resultado.criadas += 1;
      continue;
    }

    // No boleto por morador quem aparece no documento e na matriz e a unidade,
    // porque e por ela que o sindico e o cobrador reconhecem a divida.
    const aderencia = contrato.aderencias[0];
    const devedorNome =
      contrato.escopo === 'UNIDADE' && aderencia?.unidade
        ? aderencia.unidade.codigo
        : contrato.cliente.nome;

    await prisma.$transaction(async (tx) => {
      const fatura = await tx.fatura.create({
        data: {
          contratoId: contrato.id,
          competencia: new Date(`${comp}T00:00:00.000Z`),
          valorBruto: bruto,
          desconto,
          acrescimos: D(0),
          valorLiquido: liquido,
          motivo: 'job-mensal',
          itens: {
            create: itens.map((i) => ({
              contratoItemId: i.contratoItemId,
              quantidade: i.quantidade,
              precoUnitario: i.precoUnitario,
              total: i.total,
              precoVigencia: new Date(`${comp}T00:00:00.000Z`),
            })),
          },
        },
      });

      await tx.titulo.create({
        data: {
          faturaId: fatura.id,
          contratoId: contrato.id,
          competencia: new Date(`${comp}T00:00:00.000Z`),
          numero: numeroDoTitulo(contrato.numero, comp),
          devedorNome: devedorNome,
          condominioNome: contrato.condominio?.nome ?? null,
          escopo: contrato.escopo,
          valorOriginal: liquido,
          vencimento: new Date(`${vencimento}T00:00:00.000Z`),
        },
      });
    });

    resultado.criadas += 1;
  }

  return resultado;
}

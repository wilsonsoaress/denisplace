import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { D, money } from '@/domain/money';
import { competencia as toCompetencia, toDate, toISO, vencimentoDaCompetencia, type Competencia, type DateISO } from '@/domain/dates';

export type ResultadoGeracaoPagar = {
  competencia: Competencia;
  criadas: number;
  jaExistiam: number;
};

/** Numeração do lançamento a pagar: sequencial por competência, como um protocolo. */
export function numeroDaContaPagar(comp: Competencia, sequencia: number): string {
  return `P${comp.slice(0, 4)}${comp.slice(5, 7)}-${String(sequencia).padStart(5, '0')}`;
}

async function proximoNumero(tx: Prisma.TransactionClient, comp: Competencia): Promise<string> {
  const inicio = new Date(`${comp}T00:00:00.000Z`);
  const fim = new Date(`${comp}T23:59:59.999Z`);
  const quantos = await tx.contaPagar.count({ where: { competencia: { gte: inicio, lte: fim } } });
  return numeroDaContaPagar(comp, quantos + 1);
}

/**
 * Gera a proxima competencia de cada lancamento recorrente (modelo). Espelha
 * `gerarCobranca`: idempotente por (origemRecorrenteId, competencia), entao
 * reprocessar o mes nao duplica, e e isso que permite rodar de novo apos falha.
 */
export async function gerarContasPagarDaCompetencia(
  competencia: Competencia,
): Promise<ResultadoGeracaoPagar> {
  const comp = toCompetencia(competencia);
  const resultado: ResultadoGeracaoPagar = { competencia: comp, criadas: 0, jaExistiam: 0 };

  const modelos = await prisma.contaPagar.findMany({
    where: { recorrente: true, origemRecorrenteId: null },
    orderBy: { criadoEm: 'asc' },
  });

  for (const modelo of modelos) {
    // Lancamento so se repete a partir do mes em que foi criado.
    if (toCompetencia(toISO(modelo.competencia) as DateISO) > comp) continue;

    const existente = await prisma.contaPagar.findUnique({
      where: { origemRecorrenteId_competencia: { origemRecorrenteId: modelo.id, competencia: toDate(comp) } },
    });
    if (existente) {
      resultado.jaExistiam += 1;
      continue;
    }

    const diaVencimento = Number((toISO(modelo.vencimento) as DateISO).slice(8, 10));
    const vencimento = vencimentoDaCompetencia(comp, diaVencimento);

    await prisma.$transaction(async (tx) => {
      await tx.contaPagar.create({
        data: {
          numero: await proximoNumero(tx, comp),
          fornecedorNome: modelo.fornecedorNome,
          categoria: modelo.categoria,
          descricao: modelo.descricao,
          competencia: toDate(comp),
          valorOriginal: money(D(modelo.valorOriginal)),
          vencimento: toDate(vencimento),
          encargoPorAtraso: modelo.encargoPorAtraso,
          contratoId: modelo.contratoId,
          ordemServicoId: modelo.ordemServicoId,
          origemRecorrenteId: modelo.id,
        },
      });
    });
    resultado.criadas += 1;
  }

  return resultado;
}

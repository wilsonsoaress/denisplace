import { Prisma, type StatusContrato } from '@prisma/client';
import { prisma } from '@/server/db';
import { D, brl, money, sum, type Money } from '@/domain/money';
import { UNIDADE_COBRANCA } from '@/lib/rotulos';

export type Opcao = { value: string; label: string };

type ItemComPreco = { ativo: boolean; quantidade: Prisma.Decimal; precoAtual: Prisma.Decimal };

/** Mensalidade bruta do contrato com os preços vigentes hoje (sem desconto de convênio). */
export function mensalDe(itens: ItemComPreco[]): Money {
  return money(sum(...itens.filter((i) => i.ativo).map((i) => D(i.quantidade).times(D(i.precoAtual)))));
}

/** Options dos selects de contrato, uma consulta só. */
export async function listasParaContrato() {
  const [clientes, condominios, indices, catalogo, maes] = await Promise.all([
    prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
      take: 800,
    }),
    prisma.condominio.findMany({
      select: { id: true, nome: true, cidade: true },
      orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
    }),
    prisma.indiceReajuste.findMany({ select: { id: true, sigla: true }, orderBy: { sigla: 'asc' } }),
    prisma.catalogoItem.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, precoPublico: true, unidadeCobranca: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.contrato.findMany({
      where: { escopo: 'CONDOMINIO', status: { in: ['VIGENTE', 'SUSPENSO'] } },
      select: { id: true, numero: true, condominio: { select: { nome: true } } },
      orderBy: { numero: 'desc' },
      take: 200,
    }),
  ]);

  return {
    clientes: clientes.map((c) => ({ value: c.id, label: c.nome })),
    condominios: condominios.map((c) => ({
      value: c.id,
      label: `${c.nome}${c.cidade ? ` — ${c.cidade}` : ''}`,
    })),
    indices: indices.map((i) => ({ value: i.id, label: i.sigla })),
    catalogo: catalogo.map((c) => ({
      value: c.id,
      label: `${c.nome} · ${brl(c.precoPublico)} / ${UNIDADE_COBRANCA[c.unidadeCobranca].toLowerCase()}`,
    })),
    maes: maes.map((m) => ({
      value: m.id,
      label: `#${m.numero}${m.condominio ? ` · ${m.condominio.nome}` : ''}`,
    })),
  };
}

/** Unidades do condomínio do contrato (ou todas, quando o contrato não aponta condomínio). */
export async function listasParaAderencia(condominioId: string | null) {
  const [unidades, moradores] = await Promise.all([
    prisma.unidade.findMany({
      where: { ativa: true, ...(condominioId ? { condominioId } : {}) },
      select: { id: true, codigo: true, condominio: { select: { nome: true } } },
      orderBy: { codigo: 'asc' },
      take: 500,
    }),
    prisma.cliente.findMany({
      where: { ativo: true, tipo: 'PF' },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
      take: 800,
    }),
  ]);

  const grupos = new Map<string, Opcao[]>();
  for (const u of unidades) {
    const rotulo = u.condominio?.nome ?? 'sem condomínio';
    grupos.set(rotulo, [...(grupos.get(rotulo) ?? []), { value: u.id, label: u.codigo }]);
  }

  return {
    unidades: [...grupos.entries()].map(([rotulo, opcoes]) => ({ rotulo, opcoes })),
    moradores: moradores.map((m) => ({ value: m.id, label: m.nome })),
  };
}

export const SEM_CONDOMINIO: Opcao = { value: '', label: '— sem condomínio —' };
export const SEM_MAE: Opcao = { value: '', label: '— não é contrato de unidade —' };
export const SEM_INDICE: Opcao = { value: '', label: '— usar o índice do catálogo —' };
export const SEM_MORADOR: Opcao = { value: '', label: '— titular da unidade —' };

/** Cor do chip de status: a situação do contrato precisa ser lida de relance. */
export function chipStatus(status: StatusContrato): string {
  if (status === 'VIGENTE') return 'chip chip-ok';
  if (status === 'SUSPENSO') return 'chip chip-warn';
  if (status === 'DISTRATADO' || status === 'VENCIDO') return 'chip chip-bad';
  return 'chip chip-free';
}

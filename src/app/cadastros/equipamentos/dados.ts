import { prisma } from '@/server/db';

/** Condomínios e unidades para os selects da tela de equipamento. */
export async function listasParaEquipamento() {
  const [condominios, unidades] = await Promise.all([
    prisma.condominio.findMany({
      select: { id: true, nome: true, cidade: true },
      orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
    }),
    prisma.unidade.findMany({
      where: { ativa: true },
      select: { id: true, codigo: true, condominioId: true },
      orderBy: { codigo: 'asc' },
    }),
  ]);

  const grupos = condominios
    .map((c) => ({
      rotulo: `${c.nome}${c.cidade ? ` — ${c.cidade}` : ''}`,
      opcoes: unidades.filter((u) => u.condominioId === c.id).map((u) => ({ value: u.id, label: u.codigo })),
    }))
    .filter((g) => g.opcoes.length > 0);

  return {
    condominios: condominios.map((c) => ({
      value: c.id,
      label: `${c.nome}${c.cidade ? ` — ${c.cidade}` : ''}`,
    })),
    grupos,
  };
}

export const SEM_CONDOMINIO = { value: '', label: '— sem condomínio (estoque/manutenção) —' };
export const SEM_UNIDADE = { value: '', label: '— não se aplica —' };

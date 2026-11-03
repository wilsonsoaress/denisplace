import type { Papel } from '@prisma/client';
import { MODULOS_SISTEMA, PAPEIS_SISTEMA, SEM_ACESSO, type MapaPermissoes, type Modulo, type Perno } from '@/auth/perfis';
import { prisma } from './db';

/**
 * Leitura pura da matriz de permissões (tabela `permissoes_perfil`). Fica fora de
 * `server/acoes/perfis.ts` de propósito: aquele arquivo importa `auth/guard`, que
 * importa `auth` (NextAuth), que precisa chamar esta leitura no login — import
 * circular se tudo morasse no mesmo arquivo.
 */
export const PERNO_PARA_DB = { nenhum: 'NENHUM', ver: 'VER', editar: 'EDITAR' } as const;
export const DB_PARA_PERNO: Record<string, Perno> = { NENHUM: 'nenhum', VER: 'ver', EDITAR: 'editar' };
export const MODULO_PARA_DB = {
  inicio: 'INICIO',
  cadastros: 'CADASTROS',
  orcamentos: 'ORCAMENTOS',
  contratos: 'CONTRATOS',
  financeiro: 'FINANCEIRO',
  auditoria: 'AUDITORIA',
  usuarios: 'USUARIOS',
} as const;
export const DB_PARA_MODULO: Record<string, Modulo> = Object.fromEntries(
  Object.entries(MODULO_PARA_DB).map(([k, v]) => [v, k as Modulo]),
);

/** Lê a permissão de um único perfil: usado pela sessão (JWT) no login. */
export async function buscarPermissoes(papel: Papel): Promise<MapaPermissoes> {
  const linhas = await prisma.permissaoPerfil.findMany({ where: { papel } });
  const mapa = { ...SEM_ACESSO };
  for (const linha of linhas) {
    const modulo = DB_PARA_MODULO[linha.modulo];
    if (modulo) mapa[modulo] = DB_PARA_PERNO[linha.nivel] ?? 'nenhum';
  }
  return mapa;
}

/** Lê a matriz inteira (todos os perfis) para a tela de gerenciamento e o painel de referência. */
export async function buscarMatrizCompleta(): Promise<Record<Papel, MapaPermissoes>> {
  const linhas = await prisma.permissaoPerfil.findMany();
  const matriz = Object.fromEntries(PAPEIS_SISTEMA.map((p) => [p, { ...SEM_ACESSO }])) as Record<
    Papel,
    MapaPermissoes
  >;
  for (const linha of linhas) {
    const modulo = DB_PARA_MODULO[linha.modulo];
    if (modulo) matriz[linha.papel][modulo] = DB_PARA_PERNO[linha.nivel] ?? 'nenhum';
  }
  return matriz;
}

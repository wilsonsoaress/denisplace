import type { Papel } from '@prisma/client';

/**
 * Modulo/Perno continuam os mesmos tipos de antes; o que mudou é a origem do
 * valor: antes vinha de uma matriz fixa aqui no arquivo, agora vem da tabela
 * `permissoes_perfil`, editável pelo administrador em /usuarios/perfis.
 *
 * Este arquivo fica deliberadamente sem import de Prisma Client em runtime
 * de banco: `pode()` é puro (recebe o mapa de permissões já resolvido), para
 * servir tanto o servidor quanto qualquer render que só precise da lógica. A
 * leitura do banco mora em `server/acoes/perfis.ts`.
 */
export type Modulo = 'inicio' | 'cadastros' | 'orcamentos' | 'contratos' | 'financeiro' | 'auditoria' | 'usuarios';
export type Perno = 'nenhum' | 'ver' | 'editar';
export type MapaPermissoes = Record<Modulo, Perno>;

export const MODULOS_SISTEMA: Modulo[] = [
  'inicio',
  'cadastros',
  'orcamentos',
  'contratos',
  'financeiro',
  'auditoria',
  'usuarios',
];

export const PAPEIS_SISTEMA: Papel[] = ['ADMIN', 'COMERCIAL', 'FINANCEIRO', 'TECNICO'];

/** Fallback se faltar linha no banco para algum módulo: nega por padrão. */
export const SEM_ACESSO: MapaPermissoes = {
  inicio: 'nenhum',
  cadastros: 'nenhum',
  orcamentos: 'nenhum',
  contratos: 'nenhum',
  financeiro: 'nenhum',
  auditoria: 'nenhum',
  usuarios: 'nenhum',
};

export function pode(permissoes: MapaPermissoes, modulo: Modulo, perno: Perno = 'ver'): boolean {
  const tem = permissoes[modulo];
  if (perno === 'editar') return tem === 'editar';
  return tem === 'ver' || tem === 'editar';
}

/** Um href de página cai num módulo; a regra precisa valer igual para página e action. */
export function moduloDeHref(href: string): Modulo {
  const primeiro = href.split('/').filter(Boolean)[0] ?? '';
  if (primeiro === '' || primeiro === 'login') return 'inicio';
  if (primeiro === 'cadastros') return 'cadastros';
  if (primeiro === 'orcamentos') return 'orcamentos';
  if (primeiro === 'contratos') return 'contratos';
  if (primeiro === 'financeiro') return 'financeiro';
  if (primeiro === 'auditoria') return 'auditoria';
  if (primeiro === 'usuarios') return 'usuarios';
  return 'inicio';
}

export function podeVerPagina(permissoes: MapaPermissoes, href: string): boolean {
  return pode(permissoes, moduloDeHref(href));
}

export const PAPEIS_LABEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  COMERCIAL: 'Comercial',
  FINANCEIRO: 'Financeiro',
  TECNICO: 'Técnico',
};

export const MODULOS_LABEL: Record<Modulo, string> = {
  inicio: 'Início',
  cadastros: 'Cadastros',
  orcamentos: 'Orçamentos',
  contratos: 'Contratos',
  financeiro: 'Financeiro',
  auditoria: 'Auditoria',
  usuarios: 'Usuários',
};

export const PERNO_LABEL: Record<Perno, string> = {
  nenhum: 'Sem acesso',
  ver: 'Somente leitura',
  editar: 'Altera',
};

/**
 * Trava de segurança: o perfil ADMIN precisa manter EDITAR em `usuarios`
 * sempre, senão um ajuste na matriz pode trancar todo mundo para fora de
 * /usuarios/perfis sem ninguém com acesso para desfazer.
 */
export function papelTravado(papel: Papel, modulo: Modulo): boolean {
  return papel === 'ADMIN' && modulo === 'usuarios';
}

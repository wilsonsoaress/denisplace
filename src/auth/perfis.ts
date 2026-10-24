import type { Papel } from '@prisma/client';

/**
 * Matriz de permissao da F1 sobre o `Papel` que o schema ja tinha. O criterio é
 * "o que o perfil estraga se errar aqui": comercial erra no preco do orcamento,
 * financeiro erra na baixa de pagamento, tecnico nao toca dinheiro.
 */
export type Modulo = 'inicio' | 'cadastros' | 'orcamentos' | 'contratos' | 'financeiro' | 'auditoria';
export type Perno = 'nenhum' | 'ver' | 'editar';

const TUDO: Record<Modulo, Perno> = {
  inicio: 'ver',
  cadastros: 'editar',
  orcamentos: 'editar',
  contratos: 'editar',
  financeiro: 'editar',
  auditoria: 'ver',
};

const MATRIZ: Record<Papel, Record<Modulo, Perno>> = {
  ADMIN: TUDO,
  COMERCIAL: {
    inicio: 'ver',
    cadastros: 'editar',
    orcamentos: 'editar',
    contratos: 'ver',
    financeiro: 'ver',
    auditoria: 'nenhum',
  },
  FINANCEIRO: {
    inicio: 'ver',
    cadastros: 'editar',
    orcamentos: 'ver',
    contratos: 'editar',
    financeiro: 'editar',
    auditoria: 'ver',
  },
  TECNICO: {
    inicio: 'ver',
    cadastros: 'ver',
    orcamentos: 'ver',
    contratos: 'ver',
    financeiro: 'nenhum',
    auditoria: 'nenhum',
  },
};

export function pode(papel: Papel, modulo: Modulo, perno: Perno = 'ver'): boolean {
  const tem = MATRIZ[papel][modulo];
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
  return 'inicio';
}

export function podeVerPagina(papel: Papel, href: string): boolean {
  return pode(papel, moduloDeHref(href));
}

export const PAPEIS_LABEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  COMERCIAL: 'Comercial',
  FINANCEIRO: 'Financeiro',
  TECNICO: 'Técnico',
};

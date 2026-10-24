import type { Modulo } from '@/auth/perfis';

/**
 * Lista unica dos modulos da F1: alimenta o menu e a pagina inicial, para que
 * nenhum dos dois anuncie uma tela que ainda nao existe. `modulo` e a chave da
 * matriz de permissao (src/auth/perfis.ts): as tres telas de financeiro compartilham.
 */
export type Entrada = {
  href: string;
  nome: string;
  curto: string;
  desc: string;
  modulo: Modulo;
  pronto: boolean;
};

export const MODULOS: Entrada[] = [
  {
    href: '/cadastros',
    nome: 'Cadastros',
    curto: 'Cadastros',
    desc: 'Clientes, condomínios e unidades, catálogo, equipamentos, índices',
    modulo: 'cadastros',
    pronto: true,
  },
  {
    href: '/orcamentos',
    nome: 'Orçamentos',
    curto: 'Orçamentos',
    desc: 'Aprovação converte em OS (pontual) e contrato (recorrente)',
    modulo: 'orcamentos',
    pronto: true,
  },
  {
    href: '/contratos',
    nome: 'Contratos',
    curto: 'Contratos',
    desc: 'Vigência, itens, reajuste versionado, aderências e aditivos',
    modulo: 'contratos',
    pronto: true,
  },
  {
    href: '/financeiro/contas-a-receber',
    nome: 'Contas a receber',
    curto: 'Contas a receber',
    desc: 'NF, boleto, pago + data, multa/juros e ações em lote',
    modulo: 'financeiro',
    pronto: true,
  },
  {
    href: '/financeiro/matriz',
    nome: 'Matriz de inadimplência',
    curto: 'Matriz',
    desc: 'Devedor × competência, projetada dos títulos',
    modulo: 'financeiro',
    pronto: true,
  },
  {
    href: '/financeiro/dashboard',
    nome: 'Dashboard financeiro',
    curto: 'Dashboard',
    desc: 'KPIs, adimplência por competência e controle de emissão',
    modulo: 'financeiro',
    pronto: true,
  },
  {
    href: '/auditoria',
    nome: 'Trilha de auditoria',
    curto: 'Auditoria',
    desc: 'Quem mudou dinheiro ou vigência, quando e em quê',
    modulo: 'auditoria',
    pronto: true,
  },
];

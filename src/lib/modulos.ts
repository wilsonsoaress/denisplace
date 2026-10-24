/**
 * Lista unica dos modulos da F1: alimenta o menu e a pagina inicial, para que
 * nenhum dos dois anuncie uma tela que ainda nao existe.
 */
export type Modulo = {
  href: string;
  nome: string;
  curto: string;
  desc: string;
  pronto: boolean;
};

export const MODULOS: Modulo[] = [
  {
    href: '/cadastros',
    nome: 'Cadastros',
    curto: 'Cadastros',
    desc: 'Clientes, condomínios e unidades, catálogo, equipamentos, índices',
    pronto: true,
  },
  {
    href: '/contratos',
    nome: 'Contratos',
    curto: 'Contratos',
    desc: 'Vigência, itens, reajuste versionado, aderências e aditivos',
    pronto: true,
  },
  {
    href: '/financeiro/contas-a-receber',
    nome: 'Contas a receber',
    curto: 'Contas a receber',
    desc: 'NF, boleto, pago + data, multa/juros e ações em lote',
    pronto: true,
  },
  {
    href: '/financeiro/matriz',
    nome: 'Matriz de inadimplência',
    curto: 'Matriz',
    desc: 'Devedor × competência, projetada dos títulos',
    pronto: true,
  },
  {
    href: '/financeiro/dashboard',
    nome: 'Dashboard financeiro',
    curto: 'Dashboard',
    desc: 'KPIs, adimplência por competência e controle de emissão',
    pronto: true,
  },
  {
    href: '/orcamentos',
    nome: 'Orçamentos',
    curto: 'Orçamentos',
    desc: 'Aprovação converte em OS (pontual) e contrato (recorrente)',
    pronto: false,
  },
];

import { Prisma, type CategoriaContaPagar } from '@prisma/client';
import { prisma } from '@/server/db';
import { FORMA_PAGAMENTO, CATEGORIA_CONTA_PAGAR } from '@/lib/rotulos';
import { type Money } from '@/domain/money';
import { hoje, type Competencia, type DateISO } from '@/domain/dates';
import { SITUACAO_LABEL } from '@/domain/cobranca';
import { linhaDeContaPagar, type Linha } from '@/server/relatorios/contasPagar';

/**
 * Mesma ideia do contas a receber: a grade e o CSV saem da mesma funcao de
 * linhas, para o saldo da tela e do arquivo nunca divergirem.
 */

export type Filtros = {
  q: string;
  comp: Competencia | '';
  situacao: string;
  categoria: string;
  controle: string;
};

const SITUACOES = ['', 'pendente', 'vencido', 'aberto', 'pago'];
const CONTROLES = ['', 'sem_nf'];

export function lerFiltros(bruto: Record<string, string | string[] | undefined>): Filtros {
  const valor = (chave: string) => {
    const v = bruto[chave];
    return Array.isArray(v) ? v[0] ?? '' : v ?? '';
  };
  const compBruto = valor('competencia');
  const situacao = valor('situacao');
  const controle = valor('controle');
  return {
    q: valor('q'),
    comp: /^\d{4}-\d{2}$/.test(compBruto) ? (`${compBruto}-01` as Competencia) : '',
    situacao: SITUACOES.includes(situacao) ? situacao : '',
    categoria: valor('categoria'),
    controle: CONTROLES.includes(controle) ? controle : '',
  };
}

export const SITUACAO_FILTRO: Record<string, string> = {
  pendente: 'Em aberto (não pagos)',
  vencido: 'Vencidos',
  aberto: 'A vencer',
  pago: 'Pagos',
};

/** Teto da grade e do CSV, igual ao contas a receber. */
export const LIMITE_LINHAS = 500;

export async function linhasDeContasPagar(f: Filtros): Promise<Linha[]> {
  const hojeStr = hoje();
  const vencidoEm = new Date(`${hojeStr}T00:00:00.000Z`);

  const where: Prisma.ContaPagarWhereInput = {
    ...(f.comp ? { competencia: new Date(`${f.comp}T00:00:00.000Z`) } : {}),
    ...(f.categoria ? { categoria: f.categoria as CategoriaContaPagar } : {}),
    ...(f.situacao === 'pago' ? { pago: true } : {}),
    ...(f.situacao === 'pendente' ? { pago: false } : {}),
    ...(f.situacao === 'vencido' ? { pago: false, vencimento: { lt: vencidoEm } } : {}),
    ...(f.situacao === 'aberto' ? { pago: false, vencimento: { gte: vencidoEm } } : {}),
    ...(f.controle === 'sem_nf' ? { nfRecebida: false, pago: false } : {}),
    ...(f.q
      ? {
          OR: [
            { fornecedorNome: { contains: f.q, mode: 'insensitive' } },
            { numero: { contains: f.q, mode: 'insensitive' } },
            { nfNumero: { contains: f.q, mode: 'insensitive' } },
            { descricao: { contains: f.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const lancamentos = await prisma.contaPagar.findMany({
    where,
    include: {
      pagamentos: true,
      contrato: { select: { id: true, numero: true } },
      ordemServico: { select: { id: true, numero: true } },
    },
    orderBy: [{ vencimento: 'asc' }, { numero: 'asc' }],
    take: LIMITE_LINHAS,
  });

  return lancamentos.map((c) => linhaDeContaPagar(c, hojeStr));
}

function dataExcel(valor: DateISO): string {
  return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`;
}

function dinheiro(valor: Money): string {
  return valor.toFixed(2).replace('.', ',');
}

/** Mesmo formato do CSV de contas a receber: `;`, decimal com virgula, BOM. */
export function csvDeContasPagar(linhas: Linha[]): string {
  const cabecalho = [
    'Nº do lançamento',
    'Fornecedor',
    'Categoria',
    'Descrição',
    'Competência',
    'Vencimento',
    'Valor original',
    'Multa e juros',
    'Pago',
    'Saldo',
    'Situação',
    'Dias em atraso',
    'NF recebida',
    'Nº NF',
    'Quitado',
    'Data do pagamento',
    'Forma',
    'Contrato',
  ];
  const linhasTxt = linhas.map((l) =>
    [
      l.numero,
      l.fornecedor,
      CATEGORIA_CONTA_PAGAR[l.categoria],
      l.descricao,
      l.comp.slice(0, 7),
      dataExcel(l.vencimento),
      dinheiro(l.valorOriginal),
      dinheiro(l.acr),
      dinheiro(l.pago),
      dinheiro(l.saldo),
      SITUACAO_LABEL[l.situacao],
      l.dias > 0 ? String(l.dias) : '',
      l.nfRecebida ? 'sim' : 'não',
      l.nfNumero ?? '',
      l.situacao === 'pago' ? 'sim' : 'não',
      l.pagoEm ? dataExcel(l.pagoEm) : '',
      l.forma ? FORMA_PAGAMENTO[l.forma] : '',
      l.contratoNumero ? `#${l.contratoNumero}` : '',
    ]
      .map((campo) => (/[;"\n]/.test(campo) ? `"${campo.replace(/"/g, '""')}"` : campo))
      .join(';'),
  );
  return `\ufeff${[cabecalho.join(';'), ...linhasTxt].join('\r\n')}\r\n`;
}

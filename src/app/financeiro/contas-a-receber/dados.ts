import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { FORMA_PAGAMENTO } from '@/lib/rotulos';
import { type Money } from '@/domain/money';
import { hoje, type Competencia, type DateISO } from '@/domain/dates';
import { SITUACAO_LABEL } from '@/domain/cobranca';
import { linhaDeTitulo, type Linha } from '@/server/relatorios/titulos';

/**
 * A grade de contas a receber e o CSV de inadimplencia saem da mesma funcao de
 * linhas: se o saldo do CSV diferisse do saldo da tela, a conciliacao com a
 * planilha antiga nao fecharia. O "quanto deve" de cada linha vem de
 * `@/server/relatorios/titulos`, a mesma fonte do dashboard e da matriz.
 */

export type Filtros = {
  q: string;
  comp: Competencia | '';
  situacao: string;
  condominioId: string;
  controle: string;
};

const SITUACOES = ['', 'pendente', 'vencido', 'aberto', 'pago', 'isento'];
const CONTROLES = ['', 'sem_boleto', 'sem_nf'];

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
    condominioId: valor('condominio'),
    controle: CONTROLES.includes(controle) ? controle : '',
  };
}

export const SITUACAO_FILTRO: Record<string, string> = {
  pendente: 'Em aberto (não pagas)',
  vencido: 'Vencidas',
  aberto: 'A vencer',
  pago: 'Pagas',
  isento: 'Isentas',
};

/**
 * Teto da grade e do CSV: os dois exportam exatamente as linhas que a pessoa viu,
 * senão o arquivo "não bate" com a tela. Acima disso, filtre por competência.
 */
export const LIMITE_LINHAS = 500;

export async function linhasDosTitulos(f: Filtros): Promise<Linha[]> {
  const hojeStr = hoje();
  const vencidoEm = new Date(`${hojeStr}T00:00:00.000Z`);

  const where: Prisma.TituloWhereInput = {
    ...(f.comp ? { competencia: new Date(`${f.comp}T00:00:00.000Z`) } : {}),
    ...(f.condominioId ? { contrato: { condominioId: f.condominioId } } : {}),
    ...(f.situacao === 'pago' ? { pago: true } : {}),
    ...(f.situacao === 'isento' ? { isento: true, pago: false } : {}),
    ...(f.situacao === 'pendente' ? { pago: false, isento: false } : {}),
    ...(f.situacao === 'vencido' ? { pago: false, isento: false, vencimento: { lt: vencidoEm } } : {}),
    ...(f.situacao === 'aberto' ? { pago: false, isento: false, vencimento: { gte: vencidoEm } } : {}),
    ...(f.controle === 'sem_boleto' ? { boletoGerado: false, pago: false, isento: false } : {}),
    ...(f.controle === 'sem_nf' ? { nfEmitida: false, pago: false, isento: false } : {}),
    ...(f.q
      ? {
          OR: [
            { devedorNome: { contains: f.q, mode: 'insensitive' } },
            { condominioNome: { contains: f.q, mode: 'insensitive' } },
            { numero: { contains: f.q, mode: 'insensitive' } },
            { nfNumero: { contains: f.q, mode: 'insensitive' } },
            { nossoNumero: { contains: f.q, mode: 'insensitive' } },
            ...(/^\d+$/.test(f.q) ? [{ contrato: { numero: Number(f.q) } }] : []),
          ],
        }
      : {}),
  };

  const titulos = await prisma.titulo.findMany({
    where,
    include: {
      pagamentos: true,
      contrato: { select: { id: true, numero: true, condominioId: true } },
    },
    orderBy: [{ vencimento: 'asc' }, { numero: 'asc' }],
    take: LIMITE_LINHAS,
  });

  return titulos.map((t) => linhaDeTitulo(t, hojeStr));
}

/** Data de vencimento no formato do Excel brasileiro. */
function dataExcel(valor: DateISO): string {
  return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`;
}

function dinheiro(valor: Money): string {
  // Duas casas sempre: "378" viraria "378,00" na planilha, que e o que o financeiro confere.
  return valor.toFixed(2).replace('.', ',');
}

/** Separador `;` e decimal com virgula: e o que a planilha do cliente espera abrir. */
export function csvDasLinhas(linhas: Linha[]): string {
  const cabecalho = [
    'Nº do título',
    'Contrato',
    'Devedor',
    'Condomínio',
    'Competência',
    'Vencimento',
    'Valor original',
    'Multa e juros',
    'Recebido',
    'Saldo',
    'Situação',
    'Dias em atraso',
    'Boleto emitido',
    'Nosso número',
    'NF emitida',
    'Nº NF',
    'Pago',
    'Data do pagamento',
    'Forma',
    'Isento',
  ];
  const linhasTxt = linhas.map((l) =>
    [
      l.numero,
      `#${l.contratoNumero}`,
      l.devedor,
      l.condominio ?? '',
      l.comp.slice(0, 7),
      dataExcel(l.vencimento),
      dinheiro(l.valorOriginal),
      dinheiro(l.acr),
      dinheiro(l.recebido),
      l.saldo === null ? '' : dinheiro(l.saldo),
      SITUACAO_LABEL[l.situacao],
      l.dias > 0 ? String(l.dias) : '',
      l.boletoGerado ? 'sim' : 'não',
      l.nossoNumero ?? '',
      l.nfEmitida ? 'sim' : 'não',
      l.nfNumero ?? '',
      l.situacao === 'pago' ? 'sim' : 'não',
      l.pagoEm ? dataExcel(l.pagoEm) : '',
      l.forma ? FORMA_PAGAMENTO[l.forma] : '',
      l.situacao === 'isento' ? l.isentoMotivo ?? 'isenta' : '',
    ]
      .map((campo) => (/[;"\n]/.test(campo) ? `"${campo.replace(/"/g, '""')}"` : campo))
      .join(';'),
  );
  // BOM: sem ele o Excel do Windows lê "Situação" como "SituaÃ§Ã£o".
  return `\ufeff${[cabecalho.join(';'), ...linhasTxt].join('\r\n')}\r\n`;
}

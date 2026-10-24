import { type EscopoCobranca } from '@prisma/client';
import { prisma } from '@/server/db';
import { D, sum, type Money } from '@/domain/money';
import { addMonths, competencia, competenciasEntre, fimDaCompetencia, hoje, type Competencia } from '@/domain/dates';
import { adimplenciaPorValor } from '@/domain/cobranca';
import { titulosDoPeriodo, type Linha } from '@/server/relatorios/titulos';

/**
 * Numeros do dashboard financeiro. Tudo sai das mesmas `Linha` da grade de contas
 * a receber: se o KPI calculasse saldo por conta propria, o numero da tela grande
 * brigaria com o numero da lista e o financeiro voltaria para a planilha.
 */

export type FiltrosDashboard = {
  de: Competencia;
  ate: Competencia;
  condominioId: string;
  escopo: EscopoCobranca | '';
};

const MESES_PADRAO = 12;
/** Trava da janela: serie de 200 meses nao cabe na tela e o grafico ficaria ilegivel. */
const MESES_MAXIMOS = 24;

const ehMes = (v: string) => /^\d{4}-\d{2}$/.test(v);

export function lerFiltros(bruto: Record<string, string | string[] | undefined>): FiltrosDashboard {
  const valor = (chave: string) => {
    const v = bruto[chave];
    return Array.isArray(v) ? v[0] ?? '' : v ?? '';
  };
  const atual = competencia(hoje());
  let de = ehMes(valor('de')) ? (`${valor('de')}-01` as Competencia) : (addMonths(atual, -(MESES_PADRAO - 1)) as Competencia);
  let ate = ehMes(valor('ate')) ? (`${valor('ate')}-01` as Competencia) : atual;
  if (de > ate) [de, ate] = [ate, de];
  if (competenciasEntre(de, ate).length > MESES_MAXIMOS) {
    de = addMonths(ate, -(MESES_MAXIMOS - 1)) as Competencia;
  }

  const escopoBruto = valor('escopo');
  return {
    de,
    ate,
    condominioId: valor('condominio'),
    escopo: escopoBruto === 'CONDOMINIO' || escopoBruto === 'UNIDADE' ? escopoBruto : '',
  };
}

export type Barra = {
  comp: Competencia;
  recebido: Money;
  atraso: Money;
  aVencer: Money;
  devido: Money;
  adimplencia: number | null;
};

export type DevedorEmAtraso = {
  nome: string;
  condominio: string | null;
  saldo: Money;
  titulos: number;
  dias: number;
};

export type ItemComposicao = { descricao: string; total: Money; share: number };

export type ResumoDashboard = {
  receitas: { recorrente: Money; recebido: Money; atraso: Money; aVencer: Money; isento: Money; mrr: Money };
  adimplencia: number | null;
  titulos: number;
  contratos: number;
  vencidos: number;
  mrrCompetencia: Competencia | null;
  emissao: { semBoleto: number; semBoletoValor: Money; semNf: number; semNfValor: Money; semComprovante: number };
  barras: Barra[];
  devedores: DevedorEmAtraso[];
  composicao: ItemComposicao[];
};

const soma = (linhas: Linha[], campo: (l: Linha) => Money | null) =>
  sum(...linhas.map((l) => campo(l) ?? D(0)));

/** MRR = ultima competencia da janela que tem cobranca, nao "hoje" no calendario. */
function competenciaMrr(barras: Barra[]): Competencia | null {
  for (let i = barras.length - 1; i >= 0; i--) {
    const b = barras[i];
    if (b && !b.devido.isZero()) return b.comp;
  }
  return null;
}

async function composicaoDoPeriodo(f: FiltrosDashboard): Promise<ItemComposicao[]> {
  const itens = await prisma.faturaItem.findMany({
    where: {
      fatura: {
        competencia: {
          gte: new Date(`${f.de}T00:00:00.000Z`),
          lte: new Date(`${fimDaCompetencia(f.ate)}T00:00:00.000Z`),
        },
        // Isento fica fora para o painel bater com a "receita recorrente" do KPI.
        titulos: { none: { isento: true, pago: false } },
        ...(f.condominioId ? { contrato: { condominioId: f.condominioId } } : {}),
        ...(f.escopo ? { contrato: { escopo: f.escopo } } : {}),
      },
    },
    select: { total: true, contratoItem: { select: { descricao: true } } },
  });

  const por = new Map<string, Money>();
  for (const i of itens) {
    const chave = i.contratoItem.descricao;
    por.set(chave, (por.get(chave) ?? D(0)).plus(D(i.total)));
  }
  const total = sum(...[...por.values()]);
  const ordenadas = [...por.entries()]
    .map(([descricao, valor]) => ({
      descricao,
      total: valor,
      // Share em % com uma casa: e o que o comercial usa para discutir mix de receita.
      share: total.isZero() ? 0 : valor.div(total).times(100).toDecimalPlaces(1).toNumber(),
    }))
    .sort((a, b) => b.total.comparedTo(a.total));

  // Em boleto por unidade cada morador vira uma descricao propria; sem o teto de
  // linhas o painel de mix virava uma lista de 200 itens ilegivel.
  const topo = ordenadas.slice(0, 8);
  const resto = ordenadas.slice(8);
  if (resto.length > 0) {
    const valorResto = sum(...resto.map((r) => r.total));
    topo.push({
      descricao: `Demais ${resto.length} itens do catálogo`,
      total: valorResto,
      share: total.isZero() ? 0 : valorResto.div(total).times(100).toDecimalPlaces(1).toNumber(),
    });
  }
  return topo;
}

export async function resumoDoPeriodo(f: FiltrosDashboard): Promise<ResumoDashboard> {
  const linhas = await titulosDoPeriodo({
    de: f.de,
    ate: f.ate,
    condominioId: f.condominioId || null,
    escopo: f.escopo || null,
  });

  const cobrancas = linhas.filter((l) => l.situacao !== 'isento');
  const vencidas = cobrancas.filter((l) => l.situacao === 'vencido');
  const abertas = cobrancas.filter((l) => l.situacao === 'aberto');
  const pagas = cobrancas.filter((l) => l.situacao === 'pago');

  const recebido = soma(cobrancas, (l) => l.recebido);
  const atraso = soma(vencidas, (l) => l.saldo);
  const aVencer = soma(abertas, (l) => l.valorOriginal);

  const barras: Barra[] = competenciasEntre(f.de, f.ate).map((comp) => {
    const doMes = cobrancas.filter((l) => l.comp === comp);
    const r = soma(doMes, (l) => l.recebido);
    const a = soma(doMes.filter((l) => l.situacao === 'vencido'), (l) => l.saldo);
    const v = soma(doMes.filter((l) => l.situacao === 'aberto'), (l) => l.valorOriginal);
    return {
      comp,
      recebido: r,
      atraso: a,
      aVencer: v,
      devido: soma(doMes, (l) => l.valorOriginal),
      // Adimplencia por valor: pago / (pago + vencido em aberto). A aberto entra no
      // grafico mas nao no indice, senao o mes corrente pareceria inadimplente.
      adimplencia: adimplenciaPorValor(r, a),
    };
  });

  const mrrCompetencia = competenciaMrr(barras);
  const doMrr = mrrCompetencia ? cobrancas.filter((l) => l.comp === mrrCompetencia) : [];

  const porDevedor = new Map<string, DevedorEmAtraso>();
  for (const l of vencidas) {
    const atual = porDevedor.get(l.devedor);
    porDevedor.set(l.devedor, {
      nome: l.devedor,
      condominio: l.condominio,
      saldo: (atual?.saldo ?? D(0)).plus(l.saldo ?? D(0)),
      titulos: (atual?.titulos ?? 0) + 1,
      dias: Math.max(atual?.dias ?? 0, l.dias),
    });
  }

  const semBoleto = cobrancas.filter((l) => !l.boletoGerado);
  const semNf = cobrancas.filter((l) => !l.nfEmitida);

  return {
    receitas: {
      recorrente: soma(cobrancas, (l) => l.valorOriginal),
      recebido,
      atraso,
      aVencer,
      isento: soma(linhas.filter((l) => l.situacao === 'isento'), (l) => l.valorOriginal),
      mrr: soma(doMrr, (l) => l.valorOriginal),
    },
    // Isento fica fora dos dois lados da divisao: contar convenio como "nao pago"
    // faria o indice cair sem ninguem ter atrasado.
    adimplencia: adimplenciaPorValor(recebido, atraso),
    titulos: linhas.length,
    contratos: new Set(cobrancas.map((l) => l.contratoId)).size,
    vencidos: vencidas.length,
    mrrCompetencia,
    emissao: {
      semBoleto: semBoleto.length,
      semBoletoValor: soma(semBoleto, (l) => l.valorOriginal),
      semNf: semNf.length,
      semNfValor: soma(semNf, (l) => l.valorOriginal),
      semComprovante: pagas.filter((l) => l.semComprovante).length,
    },
    barras,
    devedores: [...porDevedor.values()].sort((a, b) => b.saldo.comparedTo(a.saldo)).slice(0, 8),
    composicao: await composicaoDoPeriodo(f),
  };
}

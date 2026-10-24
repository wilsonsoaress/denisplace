import { type EscopoCobranca } from '@prisma/client';
import { D, sum, type Money } from '@/domain/money';
import { addMonths, competencia, competenciasEntre, hoje, type Competencia } from '@/domain/dates';
import { adimplenciaPorValor, type Situacao } from '@/domain/cobranca';
import { titulosDoPeriodo, type Linha } from '@/server/relatorios/titulos';

/**
 * A matriz e projecao pura dos titulos: ela nao guarda estado e nao tem edicao.
 * Marcar pago na grade muda a celula na hora, e e isso que impede a matriz de
 * virar uma segunda planilha paralela ao sistema.
 */

export type FiltrosMatriz = {
  de: Competencia;
  ate: Competencia;
  condominioId: string;
  escopo: EscopoCobranca | '';
  somenteComAtraso: boolean;
};

const MESES_PADRAO = 12;
/** Matriz com 24 colunas ja nao cabe na tela; 18 e o teto util com scroll horizontal. */
const COLUNAS_MAXIMAS = 18;
const LINHAS_MAXIMAS = 300;

const ehMes = (v: string) => /^\d{4}-\d{2}$/.test(v);

export function lerFiltros(bruto: Record<string, string | string[] | undefined>): FiltrosMatriz {
  const valor = (chave: string) => {
    const v = bruto[chave];
    return Array.isArray(v) ? v[0] ?? '' : v ?? '';
  };
  const atual = competencia(hoje());
  let de = ehMes(valor('de')) ? (`${valor('de')}-01` as Competencia) : (addMonths(atual, -(MESES_PADRAO - 1)) as Competencia);
  let ate = ehMes(valor('ate')) ? (`${valor('ate')}-01` as Competencia) : atual;
  if (de > ate) [de, ate] = [ate, de];
  if (competenciasEntre(de, ate).length > COLUNAS_MAXIMAS) {
    de = addMonths(ate, -(COLUNAS_MAXIMAS - 1)) as Competencia;
  }

  const escopoBruto = valor('escopo');
  return {
    de,
    ate,
    condominioId: valor('condominio'),
    escopo: escopoBruto === 'CONDOMINIO' || escopoBruto === 'UNIDADE' ? escopoBruto : '',
    somenteComAtraso: valor('atraso') === '1',
  };
}

export type Celda = {
  situacao: Situacao;
  devido: Money;
  recebido: Money;
  saldo: Money;
  atraso: Money;
  tituloId: string | null;
  titulos: number;
};

export type LinhaMatriz = {
  chave: string;
  devedor: string;
  condominio: string | null;
  escopo: EscopoCobranca;
  celulas: Map<Competencia, Celda>;
  emAberto: Money;
  emAtraso: Money;
  recebido: Money;
  adimplencia: number | null;
};

export type ColunaMatriz = {
  comp: Competencia;
  devido: Money;
  emAberto: Money;
  emAtraso: Money;
  adimplencia: number | null;
};

export type Matriz = {
  comps: Competencia[];
  linhas: LinhaMatriz[];
  colunas: ColunaMatriz[];
  total: { titulos: number; emAberto: Money; emAtraso: Money; adimplencia: number | null };
  cortada: boolean;
};

/** Pior situacao manda na celula: um pago junto de um vencido e um devedor vencido. */
const PIOR: Situacao[] = ['vencido', 'aberto', 'pago', 'isento'];

function pior(atual: Situacao | undefined, novo: Situacao): Situacao {
  if (!atual) return novo;
  return PIOR.indexOf(novo) < PIOR.indexOf(atual) ? novo : atual;
}

export async function matrizDoPeriodo(f: FiltrosMatriz): Promise<Matriz> {
  const linhas = await titulosDoPeriodo({
    de: f.de,
    ate: f.ate,
    condominioId: f.condominioId || null,
    escopo: f.escopo || null,
  });
  const comps = competenciasEntre(f.de, f.ate);

  const grupos = new Map<string, Linha[]>();
  for (const l of linhas) {
    const chave = `${l.devedor}\u0000${l.condominio ?? ''}\u0000${l.escopo}`;
    const atual = grupos.get(chave);
    if (atual) atual.push(l);
    else grupos.set(chave, [l]);
  }

  let matriz: LinhaMatriz[] = [...grupos.entries()].map(([chave, doDevedor]) => {
    const celulas = new Map<Competencia, Celda>();
    for (const l of doDevedor) {
      const atual = celulas.get(l.comp);
      const saldo = l.saldo ?? D(0);
      const atraso = l.situacao === 'vencido' ? saldo : D(0);
      celulas.set(l.comp, {
        situacao: pior(atual?.situacao, l.situacao),
        devido: (atual?.devido ?? D(0)).plus(l.valorOriginal),
        recebido: (atual?.recebido ?? D(0)).plus(l.recebido),
        saldo: (atual?.saldo ?? D(0)).plus(saldo),
        atraso: (atual?.atraso ?? D(0)).plus(atraso),
        tituloId: atual && atual.titulos > 0 ? null : l.id,
        titulos: (atual?.titulos ?? 0) + 1,
      });
    }

    const recebido = sum(...doDevedor.map((l) => l.recebido));
    const emAtraso = sum(...doDevedor.map((l) => (l.situacao === 'vencido' ? (l.saldo ?? D(0)) : D(0))));
    const primeira = doDevedor[0];
    return {
      chave,
      devedor: primeira?.devedor ?? '',
      condominio: primeira?.condominio ?? null,
      escopo: primeira?.escopo ?? 'CONDOMINIO',
      celulas,
      emAberto: sum(...doDevedor.map((l) => l.saldo ?? D(0))),
      emAtraso,
      recebido,
      // Isento nao entra nem no numerador nem no denominador: convenio nao e atraso.
      adimplencia: adimplenciaPorValor(recebido, emAtraso),
    };
  });

  if (f.somenteComAtraso) {
    matriz = matriz.filter((m) => !m.emAtraso.isZero());
  }
  matriz.sort((a, b) => b.emAtraso.comparedTo(a.emAtraso) || a.devedor.localeCompare(b.devedor));
  const cortada = matriz.length > LINHAS_MAXIMAS;
  const visiveis = matriz.slice(0, LINHAS_MAXIMAS);

  const colunas: ColunaMatriz[] = comps.map((comp) => {
    const doMes = linhas.filter((l) => l.comp === comp);
    const recebido = sum(...doMes.map((l) => l.recebido));
    const emAtraso = sum(...doMes.map((l) => (l.situacao === 'vencido' ? (l.saldo ?? D(0)) : D(0))));
    return {
      comp,
      devido: sum(...doMes.map((l) => l.valorOriginal)),
      emAberto: sum(...doMes.map((l) => l.saldo ?? D(0))),
      emAtraso,
      adimplencia: adimplenciaPorValor(recebido, emAtraso),
    };
  });

  // Rodape calculado sobre todos os devedores do recorte, nao so os visiveis:
  // se a matriz for cortada pelo teto de linhas, o indice tem que continuar certo.
  const recebidoTotal = sum(...matriz.map((m) => m.recebido));
  const atrasoTotal = sum(...matriz.map((m) => m.emAtraso));

  return {
    comps,
    linhas: visiveis,
    colunas,
    total: {
      titulos: linhas.length,
      emAberto: sum(...matriz.map((m) => m.emAberto)),
      emAtraso: atrasoTotal,
      adimplencia: adimplenciaPorValor(recebidoTotal, atrasoTotal),
    },
    cortada,
  };
}

export const CELULA_CLASSE: Record<Situacao, string> = {
  pago: 'bg-green-50 text-green-800',
  vencido: 'bg-red-50 text-red-700',
  aberto: 'bg-amber-50 text-amber-800',
  isento: 'bg-slate-50 text-slate-400',
};

export const CELULA_ROTULO: Record<Situacao, string> = {
  pago: 'paga',
  vencido: 'vencida',
  aberto: 'a vencer',
  isento: 'isenta',
};

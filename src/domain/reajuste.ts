import { money, D, type Money } from './money';
import { addMonths, compare, type Competencia } from './dates';

/**
 * Reajuste pelo acumulado do indice no periodo de 12 (ou 6) meses.
 *
 * O indice e armazenado como variacao mensal (%) e o acumulado e o produto
 * composto, nao a soma — soma de percentuais e o erro classico de planilha
 * que este sistema veio eliminar.
 */
export type IndicePonto = { competencia: Competencia; variacaoMensal: Money };

/** Serie do indice, do mais antigo ao mais novo. */
export function acumuladoPercentual(
  serie: IndicePonto[],
  desde: Competencia,
  ate: Competencia,
): Money | null {
  const ordered = [...serie].sort((a, b) => compare(a.competencia, b.competencia));
  const janela = mesesEntre(desde, ate);
  const relevantes = ordered.filter(
    (p) => compare(p.competencia, desde) >= 0 && compare(p.competencia, ate) <= 0,
  );
  // Sem todos os pontos da janela o reajuste nao pode ser aplicado: melhor
  // barrar e avisar do que reajustar com serie incompleta.
  if (relevantes.length < janela) return null;

  let fator = D(1);
  for (const ponto of relevantes) {
    fator = fator.times(D(1).plus(ponto.variacaoMensal.div(100)));
  }
  return fator.minus(1).times(100);
}

function mesesEntre(de: Competencia, ate: Competencia): number {
  const [aDe, mDe] = de.slice(0, 7).split('-').map(Number);
  const [aAte, mAte] = ate.slice(0, 7).split('-').map(Number);
  return (aAte as number) * 12 + ((mAte as number) - 1) - ((aDe as number) * 12 + ((mDe as number) - 1)) + 1;
}

export function novoPreco(precoAtual: Money, acumuladoPct: Money): Money {
  return money(precoAtual.times(D(1).plus(acumuladoPct.div(100))));
}

/** Proxima data de reajuste a partir da vigente, conforme a periodicidade. */
export function proximoReajuste(vigenteDesde: Competencia, periodicidade: 'ANUAL' | 'SEMESTRAL' | 'NENHUM'): Competencia | null {
  if (periodicidade === 'NENHUM') return null;
  return addMonths(vigenteDesde, periodicidade === 'ANUAL' ? 12 : 6);
}

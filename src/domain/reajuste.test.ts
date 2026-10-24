import { describe, expect, it } from 'vitest';
import { acumuladoPercentual, novoPreco, proximoReajuste, type IndicePonto } from './reajuste';
import { addMonths } from './dates';
import { D, money } from './money';

function serie(de: string, ate: string, variacao: string): IndicePonto[] {
  const out: IndicePonto[] = [];
  let cursor = de;
  while (cursor <= ate) {
    out.push({ competencia: cursor, variacaoMensal: D(variacao) });
    cursor = addMonths(cursor, 1);
  }
  return out;
}

describe('acumulado do indice', () => {
  it('compoe 12 variacoes em vez de somar', () => {
    const s = serie('2025-11-01', '2026-10-01', '0.35');
    const acumulado = acumuladoPercentual(s, '2025-11-01', '2026-10-01');
    // soma ingenua daria 4,20%; composto de 12x0,35% da 4,2818%
    expect(acumulado?.toFixed(4)).toBe('4.2818');
  });

  it('barra serie incompleta em vez de reajustar no chute', () => {
    const s = serie('2026-01-01', '2026-06-01', '0.4');
    expect(acumuladoPercentual(s, '2025-11-01', '2026-10-01')).toBeNull();
  });

  it('aceita serie fora de ordem', () => {
    const s = serie('2025-11-01', '2026-10-01', '0.5').reverse();
    expect(acumuladoPercentual(s, '2025-11-01', '2026-10-01')).not.toBeNull();
  });
});

describe('novo preco', () => {
  it('arredonda para 2 casas', () => {
    expect(novoPreco(D(4800), D('4.31')).toString()).toBe('5006.88');
    expect(novoPreco(D(189), D('4.31')).toString()).toBe('197.15');
  });

  it('indice zero mantem o preco', () => {
    expect(novoPreco(D(4800), D(0)).toFixed(2)).toBe('4800.00');
  });

  it('mantem rastro do preco anterior (o dominio nao sobrescreve nada)', () => {
    const anterior = D(4800);
    const novo = novoPreco(anterior, D('4.31'));
    expect(anterior.toString()).toBe('4800');
    expect(money(novo).toFixed(2)).toBe('5006.88');
  });
});

describe('proxima data de reajuste', () => {
  it('anual soma 12 meses a competencia vigente', () => {
    expect(proximoReajuste('2026-10-01', 'ANUAL')).toBe('2027-10-01');
  });
  it('semestral soma 6', () => {
    expect(proximoReajuste('2026-10-01', 'SEMESTRAL')).toBe('2027-04-01');
  });
  it('NENHUM nunca reajusta', () => {
    expect(proximoReajuste('2026-10-01', 'NENHUM')).toBeNull();
  });
});

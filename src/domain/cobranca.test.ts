import { describe, expect, it } from 'vitest';
import { D, money, sum, brl } from './money';
import { acrescimos, adimplenciaPorValor, diasAtraso, situacaoTitulo, totalDevido } from './cobranca';
import { addDays, addMonths, competencia, competenciasEntre, daysInMonth, fimDaCompetencia, vencimentoDaCompetencia, diffDays } from './dates';

describe('dinheiro', () => {
  it('nao sofre de erro de float', () => {
    expect(money(sum(D(0.1), D(0.2))).toFixed(2)).toBe('0.30');
    expect(D(189).times(D(0.02)).plus(D(189).times(D(1)).div(100)).toString()).toBe('5.67');
  });

  // Decimal.toString() nao preenche zeros a direita; para dinheiro use toFixed(2).
  it('arredonda meio para cima em 2 casas', () => {
    expect(money(D('1.005')).toFixed(2)).toBe('1.01');
    expect(money(D('1.0049')).toFixed(2)).toBe('1.00');
    expect(money(D('2.675')).toFixed(2)).toBe('2.68');
  });

  it('formata em BRL', () => {
    expect(brl(D('4977.6'))).toBe('R$ 4.977,60');
    expect(brl(null)).toBe('R$ 0,00');
  });
});

describe('datas e competencia', () => {
  it('competencia normaliza para o primeiro dia do mes', () => {
    expect(competencia('2026-10-23')).toBe('2026-10-01');
  });

  it('addMonths ajusta dia inexistente no mes de destino', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // bissexto
    expect(addMonths('2026-10-15', 4)).toBe('2027-02-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('vencimento com dia 31 nunca cai em fevereiro', () => {
    expect(vencimentoDaCompetencia('2026-02-01', 31)).toBe('2026-02-28');
    expect(vencimentoDaCompetencia('2026-04-01', 31)).toBe('2026-04-30');
    expect(vencimentoDaCompetencia('2026-10-01', 5)).toBe('2026-10-05');
  });

  it('daysInMonth cobre 28, 29 e 31', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 10)).toBe(31);
  });

  it('diffDays ignora hora e fuso', () => {
    expect(diffDays('2026-10-05', '2026-10-23')).toBe(18);
    expect(diffDays('2026-10-23', '2026-10-05')).toBe(-18);
  });

  it('competenciasEntre gera janela ordenada e para em parametros invertidos', () => {
    expect(competenciasEntre('2026-06-15', '2026-11-02')).toEqual([
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
    expect(competenciasEntre('2026-11-01', '2026-06-01')).toEqual([]);
  });
});

describe('multa e juros', () => {
  it('dia 1 de atraso ja paga multa cheia mais juros prorrata', () => {
    const valor = D(189);
    expect(diasAtraso('2026-10-05', '2026-10-06')).toBe(1);
    // 2% = 3,78 + (1%/30 por dia = 0,063) -> 3,84
    expect(acrescimos(valor, 1).toString()).toBe('3.84');
  });

  it('18 dias de atraso em R$ 189,00 da o mesmo numero do mockup', () => {
    expect(acrescimos(D(189), 18).toString()).toBe('4.91');
  });

  it('sem atraso nao ha acrescimo', () => {
    expect(acrescimos(D(189), 0).toString()).toBe('0');
    expect(acrescimos(D(189), -3).toString()).toBe('0');
  });

  it('prorrata usa base comercial de 30 dias independentemente do mes', () => {
    expect(acrescimos(D(215), 31).toString()).toBe('6.52'); // 4,30 + 2,21
    expect(acrescimos(D(215), 30).toString()).toBe('6.45'); // 4,30 + 2,15
  });
});

describe('situacao do titulo', () => {
  const base = { vencimento: '2026-10-05', hoje: '2026-10-23' };

  it('pago vence isento: quem pagou aparece como pago', () => {
    expect(situacaoTitulo({ ...base, pago: true, isento: true })).toBe('pago');
  });

  it('isento nao vira inadimplente', () => {
    expect(situacaoTitulo({ ...base, pago: false, isento: true })).toBe('isento');
  });

  it('vencido x aberto pela data', () => {
    expect(situacaoTitulo({ ...base, pago: false, isento: false })).toBe('vencido');
    expect(situacaoTitulo({ ...base, pago: false, isento: false, vencimento: '2026-11-05' })).toBe('aberto');
  });

  it('vencido no mesmo dia do vencimento ainda nao esta em atraso', () => {
    expect(situacaoTitulo({ pago: false, isento: false, vencimento: '2026-10-23', hoje: '2026-10-23' })).toBe('aberto');
  });

  it('total devido so soma acrescimo quando vencido', () => {
    const vencido = totalDevido({ valorOriginal: D(189), pago: false, isento: false, ...base });
    expect(vencido.toFixed(2)).toBe('193.91');
    const pago = totalDevido({ valorOriginal: D(189), pago: true, isento: false, ...base });
    expect(pago.toFixed(2)).toBe('189.00');
    const aberto = totalDevido({ valorOriginal: D(189), pago: false, isento: false, ...base, vencimento: '2026-11-05' });
    expect(aberto.toFixed(2)).toBe('189.00');
  });
});

describe('adimplencia', () => {
  it('isento sai do calculo', () => {
    // 4 pagos de 5.200 e 1 vencido de 5.210+acrescimo
    const recebido = sum(D(5200), D(5252), D(5340), D(5320));
    const vencido = totalDevido({ valorOriginal: D(5210), pago: false, isento: false, vencimento: '2026-09-05', hoje: '2026-10-23' });
    expect(adimplenciaPorValor(recebido, vencido)).toBe(80);
  });

  it('retorna null quando nada estava vencivel (competencia futura)', () => {
    expect(adimplenciaPorValor(D(0), D(0))).toBeNull();
  });
});

describe('contagem de dias em calendario real', () => {
  // diffDays usou Date.UTC com mes 1-12: "31/01" rolava para marco e a diferenca
  // encolhia, cobrando menos juros do que o contrato manda.
  it('nao perde dias quando o mes de origem tem 31', () => {
    expect(diffDays('2026-01-31', '2026-02-28')).toBe(28);
    expect(diffDays('2026-01-31', '2026-03-01')).toBe(29);
    expect(diffDays('2024-01-31', '2024-02-29')).toBe(29);
  });

  it('corta no fim do mes sem depender de ano bissexto', () => {
    expect(diffDays('2026-02-01', '2026-03-01')).toBe(28);
    expect(diffDays('2026-11-30', '2026-12-31')).toBe(31);
    expect(diffDays('2026-12-31', '2027-01-31')).toBe(31);
  });

  it('addDays atravessa mes e ano', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  // O corte de adesao da cobranca usa o ultimo dia do mes: quem entra no dia 24
  // ainda e o devedor da competencia.
  it('fimDaCompetencia respeita o tamanho real do mes', () => {
    expect(fimDaCompetencia('2026-10-01')).toBe('2026-10-31');
    expect(fimDaCompetencia('2026-02-01')).toBe('2026-02-28');
    expect(fimDaCompetencia('2024-02-01')).toBe('2024-02-29');
    expect(fimDaCompetencia('2026-11-01')).toBe('2026-11-30');
  });

  it('juros de 31 dias sobre 189 usam a contagem correta', () => {
    const dias = diffDays('2026-01-31', '2026-03-03');
    expect(dias).toBe(31);
    // multa 3,78 + juros 1,89 * 31/30 = 5,73; com a contagem antiga daria 5,52
    expect(acrescimos(D(189), dias).toFixed(2)).toBe('5.73');
    expect(acrescimos(D(189), diffDays('2026-01-31', '2026-02-28')).toFixed(2)).toBe('5.54');
  });
});

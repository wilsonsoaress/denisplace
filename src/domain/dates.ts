/**
 * Datas puras (sem hora) em todo o dominio.
 *
 * O banco guarda `date`, mas o driver devolve um `Date` meia-noite UTC. Se a
 * aplicacao converter isso pelo fuso local, "2026-10-01" vira "2026-09-30" as
 * 21h de Brasilia e o job mensal gera competencia errada. Por isso o dominio
 * trabalha exclusivamente com strings `YYYY-MM-DD` e a conversao acontece na
 * borda, sempre em UTC.
 */

export type DateISO = string; // YYYY-MM-DD
export type Competencia = string; // YYYY-MM-01

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function assertDate(value: string, contexto = ''): DateISO {
  const m = RE.exec(value);
  if (!m) throw new Error(`data invalida (esperado YYYY-MM-DD): "${value}" ${contexto}`);
  const [, y, mo, d] = m as unknown as [string, string, string, string];
  const ano = Number(y);
  const mes = Number(mo);
  const dia = Number(d);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) throw new Error(`data fora de faixa: "${value}"`);
  return value;
}

/** Date do Prisma (UTC) -> string de data. */
export function toISO(value: Date | null | undefined): DateISO | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

/** String de data -> Date UTC, para gravar em coluna `date`. */
export function toDate(value: DateISO): Date {
  return new Date(`${assertDate(value)}T00:00:00.000Z`);
}

export function daysInMonth(ano: number, mes1a12: number): number {
  return new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate();
}

/** Competencia de qualquer data: o primeiro dia do mes. */
export function competencia(value: DateISO): Competencia {
  return `${value.slice(0, 7)}-01`;
}

/** Ultimo dia da competencia. */
export function fimDaCompetencia(comp: Competencia): DateISO {
  const [ano, mes] = comp.slice(0, 7).split('-').map(Number);
  return `${comp.slice(0, 7)}-${String(daysInMonth(ano as number, mes as number)).padStart(2, '0')}`;
}

export function addMonths(value: string, meses: number): string {
  const [y, m, d] = value.split('-').map(Number);
  const ano = y as number;
  const mes = m as number;
  const dia = d ?? 1;
  const total = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  // 31/01 + 1 mes nao pode virar 31/02.
  const diaFinal = Math.min(dia, daysInMonth(novoAno, novoMes));
  return `${novoAno}-${String(novoMes).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
}

/** Vencimento de uma competencia para um dia pedido, ajustado ao tamanho do mes. */
export function vencimentoDaCompetencia(comp: Competencia, dia: number): DateISO {
  const [ano, mes] = comp.slice(0, 7).split('-').map(Number);
  const diaFinal = Math.min(Math.max(1, dia), daysInMonth(ano as number, mes as number));
  return `${comp.slice(0, 7)}-${String(diaFinal).padStart(2, '0')}`;
}

/** Deslocamento em dias corridos, em calendario real (mesta noite de mes inclusiva). */
export function addDays(value: DateISO, dias: number): DateISO {
  const d = toDate(assertDate(value));
  d.setUTCDate(d.getUTCDate() + dias);
  return toISO(d) as DateISO;
}

/** Diferenca em dias corridos (b - a). */
export function diffDays(a: DateISO, b: DateISO): number {
  const da = Date.UTC(...utcParts(a));
  const db = Date.UTC(...utcParts(b));
  return Math.round((db - da) / 86_400_000);
}

function utcParts(value: DateISO): [number, number, number] {
  const [y, m, d] = assertDate(value).split('-').map(Number);
  // Date.UTC espera mes 0-11: sem o -1, "31/01" +1 mes vira "03/03" e a diferenca encolhe.
  return [y as number, (m as number) - 1, d as number];
}

export function compare(a: DateISO, b: DateISO): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Lista de competencias no intervalo, inclusive. */
export function competenciasEntre(de: Competencia, ate: Competencia): Competencia[] {
  const out: Competencia[] = [];
  let cursor = competencia(de);
  const fim = competencia(ate);
  // Guarda contra loop infinito em parametros invertidos.
  for (let i = 0; i < 600 && compare(cursor, fim) <= 0; i++) {
    out.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return out;
}

/** "Hoje" no fuso do cliente, unico ponto do codigo que olha o relogio. */
export function hoje(timezone = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo'): DateISO {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date());
}

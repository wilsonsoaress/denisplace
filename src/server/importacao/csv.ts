import { daysInMonth, type Competencia, type DateISO } from '@/domain/dates';

export type Campo<T> = { ok: true; valor: T } | { ok: false; erro: string };

export type ErroCampo = { campo: string; motivo: string; linha?: number };

export type Linha = { numero: number; valores: Record<string, string> };

export type Csv = { colunas: string[]; linhas: Linha[]; erros: ErroCampo[] };

const semAcento = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Chave de coluna sempre no mesmo formato: "Nº do Contrato" e "numero_contrato" viram `numero`. */
export function normalizarChave(bruto: string): string {
  return semAcento(bruto.trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * A planilha do cliente tem o cabeçalho escrito à mão. Cada coluna admite os
 * sinônimos que já aparecem nela; o template oficial usa o nome canônico.
 */
const ALIAS: Record<string, string> = {
  nro: 'numero',
  num: 'numero',
  no: 'numero',
  contrato: 'numero',
  numero_contrato: 'numero',
  cliente: 'cliente_nome',
  nome_cliente: 'cliente_nome',
  razao_social: 'cliente_nome',
  cpf_cnpj: 'cliente_documento',
  documento: 'cliente_documento',
  cnpj_cpf: 'cliente_documento',
  condominio: 'condominio_nome',
  nome_condominio: 'condominio_nome',
  cidade_condominio: 'condominio_cidade',
  unidade: 'unidade_codigo',
  codigo_unidade: 'unidade_codigo',
  nome_unidade: 'unidade_codigo',
  item: 'item_nome',
  servico: 'item_nome',
  produto: 'item_nome',
  descricao: 'item_nome',
  nome_item: 'item_nome',
  preco_unitario: 'preco',
  valor_unitario: 'preco',
  mensalidade: 'preco',
  data_inicio: 'inicio',
  inicio_contrato: 'inicio',
  data_fim: 'fim',
  fim_contrato: 'fim',
  dia_vencimento: 'vencimento_dia',
  vencimento: 'data_vencimento',
  data_vencimento_titulo: 'data_vencimento',
  mes: 'competencia',
  competencia_mes: 'competencia',
  valor: 'valor_cobrado',
  valor_boleto: 'valor_cobrado',
  valor_cobrado_titulo: 'valor_cobrado',
  devedor: 'devedor_nome',
  nome_devedor: 'devedor_nome',
  pago: 'esta_pago',
  status_pagamento: 'esta_pago',
  data_pagamento: 'pago_em',
  forma_pagamento: 'forma',
  meio_pagamento: 'forma',
  boleto: 'boleto_emitido',
  emitido_boleto: 'boleto_emitido',
  nf: 'nf_emitida',
  nota_fiscal: 'nf_emitida',
  isencao: 'isento',
  isento_convenio: 'isento',
  nosso_numero: 'nosso_numero',
  numero_nf: 'nf_numero',
  observacao: 'observacoes',
  motivo: 'observacoes',
};

/** Palavras de ligação e abreviatura de "número" que a pessoa escreve no cabeçalho. */
const IRRELEVANTE = new Set(['do', 'da', 'de', 'das', 'dos', 'a', 'o', 'e', 'em', 'no', 'na', 'para', 's', 'n', 'sr']);

const CANONICAS = new Set(Object.values(ALIAS));

/**
 * Cabeçalho de coluna não é chave de dados: "Nº do Contrato", "n. contrato" e
 * "Contrato" todos apontam para `numero`. O nome já canônico é preservado sem
 * cortes ("pago_em" não pode virar "pago", que é outra coluna) — e em
 * `normalizarChave`, usada para nome de cliente e unidade, nada se descarta:
 * "bloco A" e "bloco B" precisam continuar diferentes.
 */
export function colunaCanonica(bruto: string): string {
  const semAcentoBruto = semAcento(bruto.replace(/º/g, 'o').replace(/ª/g, 'a').trim().toLowerCase());
  const tokens = semAcentoBruto.split(/[^a-z0-9]+/).filter(Boolean);
  const bruta = tokens.join('_');
  if (CANONICAS.has(bruta)) return bruta;
  const enxuta = tokens.filter((t) => t.length > 1 && !IRRELEVANTE.has(t)).join('_') || bruta;
  if (CANONICAS.has(enxuta)) return enxuta;
  return ALIAS[enxuta] ?? ALIAS[bruta] ?? enxuta;
}

/**
 * Excel em pt-BR salva CSV com `;` e em ISO-8859-1. Se a decodificação UTF-8
 * resulta em caractere de substituição, o arquivo não era UTF-8.
 */
export function decodificar(bytes: Buffer): string {
  const utf8 = bytes.toString('utf8');
  return utf8.includes('\uFFFD') ? bytes.toString('latin1') : utf8;
}

export function delimitadorDe(cabecalho: string): string {
  const pontoEVirgula = (cabecalho.match(/;/g) ?? []).length;
  const virgula = (cabecalho.match(/,/g) ?? []).length;
  return pontoEVirgula >= virgula ? ';' : ',';
}

function dividir(bruto: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let dentro = false;
  for (let i = 0; i < bruto.length; i += 1) {
    const c = bruto[i];
    if (c === undefined) continue;
    if (dentro) {
      if (c === '"') {
        if (bruto[i + 1] === '"') {
          atual += '"';
          i += 1;
        } else dentro = false;
      } else atual += c;
    } else if (c === '"') dentro = true;
    else if (c === sep) {
      campos.push(atual);
      atual = '';
    } else atual += c;
  }
  campos.push(atual);
  return campos;
}

export function lerCsv(textoBruto: string): Csv {
  const texto = textoBruto.replace(/^\uFEFF/, '').replace(/\r/g, '');
  const [cabecalhoBruto = '', ...demais] = texto.split('\n');
  if (cabecalhoBruto.trim() === '') {
    return { colunas: [], linhas: [], erros: [{ campo: '_', motivo: 'Arquivo sem cabeçalho.', linha: 1 }] };
  }
  const sep = delimitadorDe(cabecalhoBruto);
  const vistas = new Set<string>();
  const erros: ErroCampo[] = [];
  const colunas = dividir(cabecalhoBruto, sep).map((bruta, i) => {
    const chave = colunaCanonica(bruta);
    if (vistas.has(chave)) {
      erros.push({ campo: chave, motivo: `Coluna "${bruta}" repetida no cabeçalho: a segunda virou ${chave}_2.`, linha: 1 });
      return `${chave}_2`;
    }
    vistas.add(chave);
    return chave;
  });
  const linhas: Linha[] = [];

  demais.forEach((bruta, i) => {
    const numero = i + 2;
    if (bruta.trim() === '') return;
    const campos = dividir(bruta, sep);
    const vazia = campos.every((c) => c.trim() === '');
    if (vazia) return;
    if (campos.length !== colunas.length) {
      erros.push({
        campo: '_',
        motivo: `Tem ${campos.length} colunas, o cabeçalho tem ${colunas.length}.`,
        linha: numero,
      });
      return;
    }
    const valores: Record<string, string> = {};
    colunas.forEach((coluna, index) => {
      valores[coluna] = (campos[index] ?? '').trim();
    });
    linhas.push({ numero, valores });
  });

  return { colunas, linhas, erros };
}

// ---------------------------------------------------------------------------
// Coerção dos valores como a planilha os escreve
// ---------------------------------------------------------------------------

export function texto(linha: Linha, coluna: string): string {
  return (linha.valores[coluna] ?? '').trim();
}

const VERDADEIRO = new Set(['sim', 's', '1', 'v', 'verdadeiro', 'true', 'pago', 'emitido']);
const FALSO = new Set(['', 'nao', 'n', '0', 'f', 'falso', 'false', 'em aberto', 'pendente', 'aberto']);

export function booleano(linha: Linha, coluna: string): Campo<boolean> {
  const bruto = texto(linha, coluna);
  const chave = semAcento(bruto.toLowerCase());
  if (VERDADEIRO.has(chave)) return { ok: true, valor: true };
  if (FALSO.has(chave)) return { ok: true, valor: false };
  return { ok: false, erro: `"${bruto}" não é sim/não.` };
}

/**
 * Dinheiro como se digita aqui: "R$ 1.234,56". Com vírgula os pontos são
 * separadores de milhar; sem vírgula o último ponto é o decimal.
 */
export function decimal(linha: Linha, coluna: string, rotulo: string): Campo<string> {
  const bruto = texto(linha, coluna).replace(/[Rr]\$\s?/, '').replace(/\s/g, '');
  if (bruto === '') return { ok: false, erro: `${rotulo} é obrigatório.` };
  const negativo = bruto.startsWith('-') || bruto.startsWith('(');
  const corpo = bruto.replace(/[()\-+]/g, '');
  const norm = corpo.includes(',') ? corpo.replace(/\./g, '').replace(',', '.') : corpo.replace(/,(?=[^,]*$)/, '.');
  if (!/^\d+(\.\d+)?$/.test(norm)) return { ok: false, erro: `${rotulo} deve ser um número (ex: 1.234,56).` };
  if (negativo) return { ok: false, erro: `${rotulo} não pode ser negativo.` };
  return { ok: true, valor: norm };
}

const PADRAO_BRA = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const PADRAO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const PADRAO_MES = /^(\d{1,2})[/-](\d{4})$/;

const doisDigitos = (v: string) => v.padStart(2, '0');

/**
 * Uma célula que não existe no calendário (13/2025, 31/02/2025) precisa virar
 * rejeição de linha aqui. Devolvida como `ok: true`, ela explode no `assertDate`
 * do domínio durante a gravação e a importação inteira aborta sem relatório.
 */
function dataDeGrupos(ano: string, mes: string, dia: string): DateISO | null {
  const m = Number(mes);
  const d = Number(dia);
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(Number(ano), m)) return null;
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

function competenciaDeGrupos(ano: string, mes: string): Competencia | null {
  const m = Number(mes);
  if (m < 1 || m > 12) return null;
  return `${ano}-${doisDigitos(mes)}-01`;
}

/** Aceita DD/MM/AAAA, DD-MM-AAAA e YYYY-MM-DD e devolve a data de domínio (ISO). */
export function data(linha: Linha, coluna: string, rotulo: string): Campo<DateISO> {
  const bruto = texto(linha, coluna);
  if (bruto === '') return { ok: false, erro: `${rotulo} é obrigatório.` };
  const brasileira = PADRAO_BRA.exec(bruto);
  if (brasileira) {
    const [, dia, mes, ano] = brasileira as unknown as [string, string, string, string];
    const valor = dataDeGrupos(ano, mes, dia);
    if (!valor) return { ok: false, erro: `${rotulo} "${bruto}" não é uma data válida.` };
    return { ok: true, valor };
  }
  const iso = PADRAO_ISO.exec(bruto);
  if (iso) {
    const [, ano, mes, dia] = iso as unknown as [string, string, string, string];
    const valor = dataDeGrupos(ano, mes, dia);
    if (!valor) return { ok: false, erro: `${rotulo} "${bruto}" não é uma data válida.` };
    return { ok: true, valor };
  }
  return { ok: false, erro: `${rotulo} use DD/MM/AAAA (ex: 05/11/2025).` };
}

/** Data opcional: célula vazia é ausente, não erro. */
export function dataOpcional(linha: Linha, coluna: string, rotulo: string): Campo<DateISO | ''> {
  if (texto(linha, coluna) === '') return { ok: true, valor: '' };
  return data(linha, coluna, rotulo);
}

/** Competência a partir de MM/AAAA, MM-AAAA ou de uma data ISO do mês. */
export function competencia(linha: Linha, coluna: string, rotulo: string): Campo<Competencia> {
  const bruto = texto(linha, coluna);
  if (bruto === '') return { ok: false, erro: `${rotulo} é obrigatório.` };
  const mensal = PADRAO_MES.exec(bruto);
  if (mensal) {
    const [, mes, ano] = mensal as unknown as [string, string, string];
    const valor = competenciaDeGrupos(ano, mes);
    if (!valor) return { ok: false, erro: `${rotulo} "${bruto}" não é um mês válido.` };
    return { ok: true, valor };
  }
  if (PADRAO_ISO.test(bruto)) {
    const dataConvertida = data(linha, coluna, rotulo);
    if (!dataConvertida.ok) return dataConvertida;
    return { ok: true, valor: `${dataConvertida.valor.slice(0, 7)}-01` };
  }
  return { ok: false, erro: `${rotulo} use MM/AAAA (ex: 11/2025).` };
}

export function inteiro(linha: Linha, coluna: string, rotulo: string, minimo: number, maximo: number): Campo<number> {
  const bruto = texto(linha, coluna);
  if (bruto === '') return { ok: false, erro: `${rotulo} é obrigatório.` };
  const valor = Number(bruto);
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    return { ok: false, erro: `${rotulo} deve ser um número inteiro entre ${minimo} e ${maximo}.` };
  }
  return { ok: true, valor };
}

/** Enum tolerante a acento e caixa; `sinonimos` cobre como a planilha escreve por extenso. */
export function enumBr<T extends string>(
  linha: Linha,
  coluna: string,
  rotulo: string,
  valores: readonly T[],
  sinonimos?: Record<string, T>,
): Campo<T> {
  const bruto = texto(linha, coluna);
  if (bruto === '') return { ok: false, erro: `${rotulo} é obrigatório.` };
  const chave = normalizarChave(bruto);
  const peloSinonimo = sinonimos?.[chave];
  const encontrado = valores.find((v) => normalizarChave(v) === chave) ?? peloSinonimo;
  if (!encontrado) {
    return { ok: false, erro: `${rotulo} "${bruto}" não é um dos valores: ${valores.join(', ')}.` };
  }
  return { ok: true, valor: encontrado };
}

export function documentoBruto(linha: Linha, coluna: string, rotulo: string): Campo<string> {
  const digitos = texto(linha, coluna).replace(/\D/g, '');
  if (digitos === '') return { ok: true, valor: '' };
  if (digitos.length !== 11 && digitos.length !== 14) {
    return { ok: false, erro: `${rotulo} deve ter 11 dígitos (CPF) ou 14 (CNPJ).` };
  }
  return { ok: true, valor: digitos };
}

// ---------------------------------------------------------------------------
// Saída (relatório de rejeições abre no Excel do cliente)
// ---------------------------------------------------------------------------

export function escreverCsv(cabecalhos: string[], linhas: string[][]): string {
  const campo = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cabecalho = cabecalhos.map(campo).join(';');
  const corpo = linhas.map((l) => l.map(campo).join(';'));
  return [cabecalho, ...corpo].join('\r\n') + '\r\n';
}

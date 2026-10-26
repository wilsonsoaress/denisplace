import type { Competencia, DateISO } from '@/domain/dates';
import type { Campo, ErroCampo, Linha } from './csv';
import { booleano, competencia, data, dataOpcional, decimal, documentoBruto, enumBr, inteiro, texto } from './csv';

const TIPO_PESSOA = ['PF', 'PJ'] as const;
const ESCOPO = ['CONDOMINIO', 'UNIDADE'] as const;
const STATUS_CONTRATO = ['RASCUNHO', 'VIGENTE', 'SUSPENSO', 'DISTRATADO', 'VENCIDO'] as const;
const PERIODICIDADE = ['ANUAL', 'SEMESTRAL', 'NENHUM'] as const;
const FORMAS = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'CHEQUE', 'CARTAO', 'BOLETO', 'OUTRO'] as const;

/** Como a planilha escrita à mão chama cada enum, além da sigla do sistema. */
const SINONIMOS_TIPO: Record<string, 'PF' | 'PJ'> = { pessoa_fisica: 'PF', pessoa_juridica: 'PJ' };
const SINONIMOS_ESCOPO: Record<string, 'CONDOMINIO' | 'UNIDADE'> = {
  boleto_unico: 'CONDOMINIO',
  unico: 'CONDOMINIO',
  por_unidade: 'UNIDADE',
  boleto_por_unidade: 'UNIDADE',
};
const SINONIMOS_FORMA: Record<string, (typeof FORMAS)[number]> = {
  pix: 'PIX',
  dinheiro: 'DINHEIRO',
  transferencia: 'TRANSFERENCIA',
  ted: 'TRANSFERENCIA',
  doc: 'TRANSFERENCIA',
  cheque: 'CHEQUE',
  cartao: 'CARTAO',
  boleto_bancario: 'BOLETO',
};

export type LinhaContrato = {
  numero: number;
  clienteNome: string;
  clienteDocumento: string;
  clienteTipo: (typeof TIPO_PESSOA)[number];
  condominioNome: string;
  condominioCidade: string;
  unidadeCodigo: string;
  escopo: (typeof ESCOPO)[number];
  itemNome: string;
  quantidade: string;
  preco: string;
  inicio: DateISO;
  fim: DateISO | '';
  vencimentoDia: number;
  indiceSigla: string;
  periodicidade: (typeof PERIODICIDADE)[number];
  status: (typeof STATUS_CONTRATO)[number];
  observacoes: string;
};

export type LinhaCobranca = {
  numero: number;
  competencia: Competencia;
  valor: string;
  vencimento: DateISO | '';
  devedorNome: string;
  pago: boolean;
  pagoEm: DateISO | '';
  forma: (typeof FORMAS)[number];
  boletoEmitido: boolean;
  nfEmitida: boolean;
  nfNumero: string;
  isento: boolean;
  nossoNumero: string;
  observacoes: string;
};

function registrar(erros: ErroCampo[], campo: string, resultado: Campo<unknown>): void {
  if (!resultado.ok) erros.push({ campo, motivo: resultado.erro });
}

/** Coluna opcional com enum: vazia usa o padrão da F1, preenchida precisa ser válida. */
function enumOpcional<T extends string>(
  linha: Linha,
  coluna: string,
  rotulo: string,
  valores: readonly T[],
  padrao: T,
  erros: ErroCampo[],
  sinonimos?: Record<string, T>,
): T {
  if (texto(linha, coluna) === '') return padrao;
  const resultado = enumBr(linha, coluna, rotulo, valores, sinonimos);
  if (resultado.ok) return resultado.valor;
  erros.push({ campo: coluna, motivo: resultado.erro });
  return padrao;
}

/**
 * Linha da aba de contratos: um item de um contrato. O mesmo contrato costuma
 * ocupar duas linhas (dois itens), então a consistência entre elas é conferida
 * no agrupamento, não aqui.
 */
export function lerLinhaContrato(linha: Linha): { dados: LinhaContrato | null; erros: ErroCampo[] } {
  const erros: ErroCampo[] = [];

  const numero = inteiro(linha, 'numero', 'Número do contrato', 1, 999_999);
  registrar(erros, 'numero', numero);

  const clienteNome = texto(linha, 'cliente_nome');
  if (clienteNome === '') erros.push({ campo: 'cliente_nome', motivo: 'Nome do cliente é obrigatório.' });

  const documento = documentoBruto(linha, 'cliente_documento', 'CPF / CNPJ do cliente');
  registrar(erros, 'cliente_documento', documento);

  const escopo = enumBr(linha, 'escopo', 'Escopo da cobrança', ESCOPO, SINONIMOS_ESCOPO);
  registrar(erros, 'escopo', escopo);

  const itemNome = texto(linha, 'item_nome');
  if (itemNome === '') erros.push({ campo: 'item_nome', motivo: 'Item do catálogo é obrigatório.' });

  const preco = decimal(linha, 'preco', 'Preço');
  registrar(erros, 'preco', preco);
  const quantidade =
    texto(linha, 'quantidade') === ''
      ? ({ ok: true, valor: '1' } as const)
      : decimal(linha, 'quantidade', 'Quantidade');
  registrar(erros, 'quantidade', quantidade);

  const inicio = data(linha, 'inicio', 'Início');
  registrar(erros, 'inicio', inicio);
  const fim = dataOpcional(linha, 'fim', 'Fim');
  registrar(erros, 'fim', fim);

  const condominioNome = texto(linha, 'condominio_nome');
  const condominioCidade = texto(linha, 'condominio_cidade');
  if (escopo.ok && escopo.valor === 'UNIDADE' && condominioNome === '') {
    erros.push({ campo: 'condominio_nome', motivo: 'Contrato por unidade precisa do condomínio para localizar a unidade.' });
  }
  if (condominioNome !== '' && condominioCidade === '') {
    erros.push({ campo: 'condominio_cidade', motivo: 'Condomínio é identificado por nome e cidade.' });
  }

  const documentoValor = documento.ok ? documento.valor : '';
  const diaBruto = texto(linha, 'vencimento_dia');
  const vencimentoDia = diaBruto === '' ? 5 : Number(diaBruto);
  if (!Number.isInteger(vencimentoDia) || vencimentoDia < 1 || vencimentoDia > 31) {
    erros.push({ campo: 'vencimento_dia', motivo: 'Dia de vencimento deve ser um número entre 1 e 31.' });
  }

  const tipo = enumOpcional(linha, 'cliente_tipo', 'Tipo de pessoa', TIPO_PESSOA,
    // Sem a coluna, o tamanho do documento diz quem é: 14 dígitos é CNPJ.
    documentoValor.length === 14 ? 'PJ' : 'PF',
    erros,
    SINONIMOS_TIPO,
);

  if (erros.length > 0) return { dados: null, erros };

  return {
    dados: {
      numero: numero.ok ? numero.valor : 0,
      clienteNome,
      clienteDocumento: documentoValor,
      clienteTipo: tipo,
      condominioNome,
      condominioCidade,
      unidadeCodigo: texto(linha, 'unidade_codigo'),
      escopo: escopo.ok ? escopo.valor : 'CONDOMINIO',
      itemNome,
      quantidade: quantidade.ok ? quantidade.valor : '1',
      preco: preco.ok ? preco.valor : '0',
      inicio: inicio.ok ? inicio.valor : '',
      fim: fim.ok ? fim.valor : '',
      vencimentoDia,
      indiceSigla: texto(linha, 'indice_sigla'),
      periodicidade: enumOpcional(linha, 'periodicidade_reajuste', 'Periodicidade de reajuste', PERIODICIDADE, 'ANUAL', erros),
      status: enumOpcional(linha, 'status', 'Status do contrato', STATUS_CONTRATO, 'VIGENTE', erros),
      observacoes: texto(linha, 'observacoes'),
    },
    erros,
  };
}

/** Linha do histórico de cobrança: um mês de um contrato. */
export function lerLinhaCobranca(linha: Linha): { dados: LinhaCobranca | null; erros: ErroCampo[] } {
  const erros: ErroCampo[] = [];

  const numero = inteiro(linha, 'numero', 'Número do contrato', 1, 999_999);
  registrar(erros, 'numero', numero);

  const competenciaValor = competencia(linha, 'competencia', 'Competência');
  registrar(erros, 'competencia', competenciaValor);

  const valor = decimal(linha, 'valor_cobrado', 'Valor cobrado');
  registrar(erros, 'valor_cobrado', valor);

  const vencimento = dataOpcional(linha, 'data_vencimento', 'Vencimento');
  registrar(erros, 'data_vencimento', vencimento);

  const pago = booleano(linha, 'esta_pago');
  registrar(erros, 'esta_pago', pago);
  const pagoEm = dataOpcional(linha, 'pago_em', 'Data do pagamento');
  registrar(erros, 'pago_em', pagoEm);
  const boletoEmitido = booleano(linha, 'boleto_emitido');
  registrar(erros, 'boleto_emitido', boletoEmitido);
  const nfEmitida = booleano(linha, 'nf_emitida');
  registrar(erros, 'nf_emitida', nfEmitida);
  const isento = booleano(linha, 'isento');
  registrar(erros, 'isento', isento);
  const forma = enumOpcional(linha, 'forma', 'Forma de pagamento', FORMAS, 'OUTRO', erros, SINONIMOS_FORMA);

  // Regra da F1: pago sem data não existe, porque matriz e aging leem a data.
  if (pago.ok && pago.valor && pagoEm.ok && pagoEm.valor === '') {
    erros.push({ campo: 'pago_em', motivo: 'Pagamento sem data é bloqueado: informe quando foi pago.' });
  }
  if (pago.ok && pago.valor && isento.ok && isento.valor) {
    erros.push({ campo: 'isento', motivo: 'Título isento não pode estar pago: escolha um dos dois.' });
  }

  if (erros.length > 0) return { dados: null, erros };

  return {
    dados: {
      numero: numero.ok ? numero.valor : 0,
      competencia: competenciaValor.ok ? competenciaValor.valor : '',
      valor: valor.ok ? valor.valor : '0',
      vencimento: vencimento.ok ? vencimento.valor : '',
      devedorNome: texto(linha, 'devedor_nome'),
      pago: pago.ok ? pago.valor : false,
      pagoEm: pagoEm.ok ? pagoEm.valor : '',
      forma,
      boletoEmitido: boletoEmitido.ok ? boletoEmitido.valor : false,
      nfEmitida: nfEmitida.ok ? nfEmitida.valor : false,
      nfNumero: texto(linha, 'nf_numero'),
      isento: isento.ok ? isento.valor : false,
      nossoNumero: texto(linha, 'nosso_numero'),
      observacoes: texto(linha, 'observacoes'),
    },
    erros,
  };
}

/** Duas linhas que dizem ser o mesmo contrato não podem contar histórias diferentes. */
export function inconsistenciaDoGrupo(base: LinhaContrato, nova: LinhaContrato): string | null {
  const campos: Array<[string, keyof LinhaContrato]> = [
    ['cliente_nome', 'clienteNome'],
    ['escopo', 'escopo'],
    ['inicio', 'inicio'],
    ['status', 'status'],
  ];
  for (const [rotulo, chave] of campos) {
    if (base[chave] !== nova[chave]) {
      return `linhas do contrato ${base.numero} divergem em ${rotulo}: "${String(base[chave])}" e "${String(nova[chave])}".`;
    }
  }
  return null;
}

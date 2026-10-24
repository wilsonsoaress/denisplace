'use server';

import { z } from 'zod';
import { Prisma, type StatusContrato } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  dataISO,
  dataOpcional,
  decimal,
  decimalOpcional,
  enumDe,
  obrigatorio,
  opcional,
  validar,
} from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { D, brlPct, money } from '@/domain/money';
import { addDays, addMonths, competencia, toDate, type Competencia } from '@/domain/dates';
import { acumuladoPercentual, janelaDeReajuste, novoPreco, proximoReajuste } from '@/domain/reajuste';
import { prisma } from '../db';
import { colunaDuplicada } from '../erros';
import { gerarCobranca } from '../cobranca/gerar';

const schemaContrato = z.object({
  clienteId: obrigatorio('Cliente', 40),
  condominioId: opcional(40),
  parentContractId: opcional(40),
  escopo: enumDe('Escopo de cobrança', ['CONDOMINIO', 'UNIDADE'] as const),
  inicio: dataISO('Início da vigência'),
  fim: dataOpcional('Fim da vigência'),
  vencimentoDia: z
    .string({ required_error: 'Dia de vencimento é obrigatório.' })
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n >= 1 && n <= 31, 'Dia de vencimento entre 1 e 31.'),
  descontoPct: decimalOpcional('Desconto (%)').default('0'),
  observacoes: opcional(2000),
});

type DadosContrato = z.infer<typeof schemaContrato>;

function paraBanco(d: DadosContrato) {
  const desconto = D(d.descontoPct);
  return {
    clienteId: d.clienteId,
    condominioId: d.condominioId || null,
    parentContractId: d.parentContractId || null,
    escopo: d.escopo,
    inicio: toDate(d.inicio),
    fim: d.fim ? toDate(d.fim) : null,
    vencimentoDia: d.vencimentoDia,
    descontoPct: desconto,
    observacoes: d.observacoes || null,
  };
}

function validarPeriodo(d: DadosContrato): EstadoForm | null {
  if (d.fim && d.fim <= d.inicio) {
    return { erros: { fim: 'O fim da vigência precisa ser depois do início.' } };
  }
  if (d.descontoPct !== undefined && Number(d.descontoPct) > 100) {
    return { erros: { descontoPct: 'Desconto não pode passar de 100%.' } };
  }
  if (d.escopo === 'CONDOMINIO' && d.parentContractId) {
    return { erros: { parentContractId: 'Só contrato por unidade pode pendurar-se a um contrato-mãe.' } };
  }
  return null;
}

function rotulosDeErro(erro: unknown): EstadoForm {
  if (colunaDuplicada(erro)) return { erros: { _: 'O contrato já foi criado por outra pessoa neste instante. Recarregue a lista.' } };
  throw erro;
}

export async function criarContrato(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schemaContrato, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const periodo = validarPeriodo(resultado.dados);
  if (periodo) return periodo;

  const data = paraBanco(resultado.dados);
  try {
    const contrato = await prisma.$transaction(async (tx) => {
      const ultimo = await tx.contrato.aggregate({ _max: { numero: true } });
      return tx.contrato.create({
        data: { ...data, numero: (ultimo._max.numero ?? 0) + 1, status: 'RASCUNHO' },
      });
    });
    revalidatePath('/contratos');
    redirect(`/contratos/${contrato.id}?criado=1`);
  } catch (erro) {
    return rotulosDeErro(erro);
  }
}

export async function salvarContrato(
  id: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaContrato, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const periodo = validarPeriodo(resultado.dados);
  if (periodo) return periodo;

  await prisma.contrato.update({ where: { id }, data: paraBanco(resultado.dados) });
  revalidatePath('/contratos');
  revalidatePath(`/contratos/${id}`);
  return { mensagem: 'Contrato atualizado.' };
}

type AcaoStatus = 'ativar' | 'suspender' | 'retomar';

const TRANSICOES: Record<AcaoStatus, { de: StatusContrato[]; para: StatusContrato }> = {
  ativar: { de: ['RASCUNHO', 'SUSPENSO', 'VENCIDO'], para: 'VIGENTE' },
  suspender: { de: ['VIGENTE'], para: 'SUSPENSO' },
  retomar: { de: ['SUSPENSO'], para: 'VIGENTE' },
};

export async function mudarStatus(id: string, acao: AcaoStatus) {
  const transicao = TRANSICOES[acao];
  const contrato = await prisma.contrato.findUnique({
    where: { id },
    include: { itens: { where: { ativo: true } } },
  });
  if (!contrato) return;
  if (!transicao.de.includes(contrato.status)) return;
  // Contrato sem item ativo não gera cobrança: ativar só criaria fatura de R$ 0.
  if (transicao.para === 'VIGENTE' && contrato.itens.length === 0) return;

  await prisma.contrato.update({ where: { id }, data: { status: transicao.para } });
  revalidatePath('/contratos');
  revalidatePath(`/contratos/${id}`);
}

const schemaDistrato = z.object({
  data: dataISO('Data do distrato'),
  motivo: obrigatorio('Motivo', 500),
});

export async function distratar(id: string, _prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schemaDistrato, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const contrato = await prisma.contrato.findUnique({ where: { id }, include: { itens: true } });
  if (!contrato) return { erros: { _: 'Contrato não encontrado.' } };
  if (resultado.dados.data < contrato.inicio.toISOString().slice(0, 10)) {
    return { erros: { data: 'A data do distrato não pode ser anterior ao início da vigência.' } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.contrato.update({
      where: { id },
      data: {
        status: 'DISTRATADO',
        fim: toDate(resultado.dados.data),
        distratoEm: toDate(resultado.dados.data),
        distratoMotivo: resultado.dados.motivo,
      },
    });
    // Encerra os itens para que a competência seguinte já não entre na cobrança.
    for (const i of contrato.itens) {
      await tx.contratoItem.update({
        where: { id: i.id },
        data: { ativo: false, fim: toDate(resultado.dados.data) },
      });
    }
    await registrarAditivo(
      tx,
      id,
      'DISTRACTO',
      competencia(resultado.dados.data),
      `Distrato: ${resultado.dados.motivo}`,
      { detalhe: `Vigência encerrada em ${resultado.dados.data}` },
    );
  });

  revalidatePath('/contratos');
  revalidatePath(`/contratos/${id}`);
  redirect(`/contratos/${id}?salvo=1`);
}

async function registrarAditivo(
  tx: Prisma.TransactionClient,
  contratoId: string,
  tipo: 'DISTRACTO' | 'REAJUSTE' | 'ACRESCIMO' | 'REMOCAO' | 'ALTERACAO',
  comp: Competencia,
  descricao: string,
  valores?: { anterior?: string; novo?: string; detalhe?: string },
) {
  const ultimo = await tx.aditivoContratual.aggregate({ where: { contratoId }, _max: { numero: true } });
  return tx.aditivoContratual.create({
    data: {
      contratoId,
      numero: (ultimo._max.numero ?? 0) + 1,
      tipo,
      competencia: toDate(comp),
      descricao,
      valorAnterior: valores?.anterior ? new Prisma.Decimal(valores.anterior) : null,
      valorNovo: valores?.novo ? new Prisma.Decimal(valores.novo) : null,
      detalhe: valores?.detalhe ?? null,
    },
  });
}

const schemaItem = z.object({
  catalogoItemId: obrigatorio('Item do catálogo', 40),
  quantidade: decimal('Quantidade'),
  precoUnitario: decimalOpcional('Preço unitário'),
  inicio: dataISO('Início do preço'),
  fim: dataOpcional('Fim'),
  indiceReajusteId: opcional(40),
  periodicidade: enumDe('Periodicidade do reajuste', ['ANUAL', 'SEMESTRAL', 'NENHUM'] as const),
});

export async function adicionarItem(
  contratoId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaItem, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;

  if (d.fim && d.fim <= d.inicio) {
    return { erros: { fim: 'O fim do item precisa ser depois do início.' } };
  }

  const catalogo = await prisma.catalogoItem.findUnique({ where: { id: d.catalogoItemId } });
  if (!catalogo) return { erros: { catalogoItemId: 'Escolha um item do catálogo.' } };
  if (!catalogo.ativo) return { erros: { catalogoItemId: 'Este item está inativo no catálogo.' } };

  const vigencia = competencia(d.inicio);
  // Vazio usa a tabela do catálogo: o preço praticado costuma ser o público, e
  // quem digita não precisa decorar o valor de referência.
  const preco = money(d.precoUnitario ? D(d.precoUnitario) : D(catalogo.precoPublico));
  const quantidade = D(d.quantidade);
  const indice = d.indiceReajusteId || catalogo.indiceReajusteId;
  const proximo =
    d.periodicidade === 'NENHUM' || !indice ? null : addMonths(vigencia, d.periodicidade === 'ANUAL' ? 12 : 6);

  await prisma.$transaction(async (tx) => {
    await tx.contratoItem.create({
      data: {
        contratoId,
        catalogoItemId: catalogo.id,
        // Snapshot: se o catálogo mudar de nome depois, a cobrança histórica não muda.
        descricao: catalogo.nome,
        quantidade,
        precoInicial: preco,
        precoAtual: preco,
        vigenciaDesde: toDate(vigencia),
        inicio: toDate(d.inicio),
        fim: d.fim ? toDate(d.fim) : null,
        indiceReajusteId: indice,
        periodicidade: d.periodicidade,
        proximoReajusteEm: proximo ? toDate(proximo) : null,
      },
    });
    await registrarAditivo(
      tx,
      contratoId,
      'ACRESCIMO',
      vigencia,
      `Inclusão de ${quantidade.toString()} × ${catalogo.nome} a ${preco.toString()}`,
      { novo: preco.mul(quantidade).toString() },
    );
  });

  revalidatePath(`/contratos/${contratoId}`);
  return { mensagem: `Item ${catalogo.nome} incluído no contrato.` };
}

export async function encerrarItem(
  contratoId: string,
  itemId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const schema = z.object({ fim: dataISO('Data de encerramento') });
  const resultado = validar(schema, fd);
  if (!resultado.ok) return { erros: { fim: 'Informe a data em que o item deixa de ser cobrado.' } };

  const item = await prisma.contratoItem.findFirst({ where: { id: itemId, contratoId } });
  if (!item) return { erros: { _:`Item não pertence a este contrato.` } };
  const inicio = item.inicio.toISOString().slice(0, 10);
  if (resultado.dados.fim < inicio) {
    return { erros: { fim: 'O encerramento não pode ser anterior ao início do item.' } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.contratoItem.update({
      where: { id: itemId },
      data: { ativo: false, fim: toDate(resultado.dados.fim) },
    });
    await registrarAditivo(
      tx,
      contratoId,
      'REMOCAO',
      competencia(resultado.dados.fim),
      `Encerramento de ${item.descricao} a partir de ${resultado.dados.fim}`,
      { anterior: item.precoAtual.toString() },
    );
  });

  revalidatePath(`/contratos/${contratoId}`);
  return { mensagem: `Item ${item.descricao} encerrado.` };
}

const schemaReajuste = z.object({
  competencia: dataISO('Competência do reajuste'),
});

/**
 * Reajuste NUNCA sobrescreve o preço anterior: cria linha nova de versão
 * (precoAtual + vigenciaDesde) e um aditivo que prova o indice usado. Assim a
 * cobranca de competencia antiga continua auditavel.
 */
export async function aplicarReajuste(
  contratoId: string,
  itemId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaReajuste, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const item = await prisma.contratoItem.findFirst({
    where: { id: itemId, contratoId },
    include: { indiceReajuste: true },
  });
  if (!item) return { erros: { _: 'Item não encontrado.' } };
  if (!item.indiceReajusteId || !item.indiceReajuste) {
    return { erros: { competencia: 'Este item não tem índice de reajuste vinculado.' } };
  }
  if (item.periodicidade === 'NENHUM') {
    return { erros: { competencia: 'Este item está cadastrado sem reajuste; altere a periodicidade antes.' } };
  }

  const comp = competencia(resultado.dados.competencia) as Competencia;
  const vigenteDesde = item.vigenciaDesde.toISOString().slice(0, 10);
  if (comp <= vigenteDesde) {
    return {
      erros: { competencia: `Já existe preço vigente desde ${vigenteDesde}. O reajuste precisa ser posterior.` },
    };
  }

  const { desde, ate, meses } = janelaDeReajuste(comp, item.periodicidade);

  const valores = await prisma.indiceValor.findMany({
    where: {
      indiceId: item.indiceReajusteId,
      competencia: { gte: toDate(desde), lte: toDate(ate) },
    },
    orderBy: { competencia: 'asc' },
  });

  const acumulado = acumuladoPercentual(
    valores.map((v) => ({
      competencia: v.competencia.toISOString().slice(0, 10),
      variacaoMensal: v.variacaoMensal,
    })),
    desde,
    ate,
  );
  if (acumulado === null) {
    return {
      erros: {
        competencia: `Série do ${item.indiceReajuste.sigla} incompleta entre ${desde.slice(0, 7)} e ${ate.slice(0, 7)} (${valores.length}/${meses} meses). O reajuste foi barrado em vez de estimado.`,
      },
    };
  }

  const anterior = money(D(item.precoAtual));
  const novo = novoPreco(anterior, acumulado);
  const detalhe = `${item.indiceReajuste.sigla} acumulado ${meses}m (${desde.slice(0, 7)} a ${ate.slice(0, 7)}) = ${brlPct(acumulado)}`;

  await prisma.$transaction(async (tx) => {
    await tx.contratoItem.update({
      where: { id: itemId },
      data: {
        precoAtual: novo,
        vigenciaDesde: toDate(comp),
        proximoReajusteEm: toDate(addMonths(comp, meses)),
      },
    });
    await registrarAditivo(tx, contratoId, 'REAJUSTE', comp, `Reajuste de ${item.descricao}`, {
      anterior: anterior.toString(),
      novo: novo.toString(),
      detalhe,
    });
  });

  revalidatePath('/contratos');
  revalidatePath(`/contratos/${contratoId}`);
  return { mensagem: `Reajuste aplicado: ${item.descricao} passou a ${novo.toString()} a partir de ${comp.slice(0, 7)}.` };
}

const schemaAderencia = z.object({
  unidadeId: obrigatorio('Unidade', 40),
  desde: dataISO('Desde'),
  moradorId: opcional(40),
});

/**
 * Aderencia nova substitui a anterior da mesma unidade (fecha com ate = desde-1).
 * Trocar morador nunca reescreve o contrato: o historico de quem morava fica intacto.
 */
export async function aderirUnidade(
  contratoId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaAderencia, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;

  const contrato = await prisma.contrato.findUnique({ where: { id: contratoId } });
  if (!contrato) return { erros: { _: 'Contrato não encontrado.' } };
  if (contrato.escopo !== 'UNIDADE') {
    return { erros: { unidadeId: 'Este contrato cobra o condomínio inteiro; não há adesão por unidade.' } };
  }
  if (d.desde < contrato.inicio.toISOString().slice(0, 10)) {
    return { erros: { desde: 'A adesão não pode ser anterior ao início do contrato.' } };
  }

  const unidade = await prisma.unidade.findUnique({
    where: { id: d.unidadeId },
    include: { titular: true },
  });
  if (!unidade || !unidade.ativa) return { erros: { unidadeId: 'Unidade inexistente ou inativa.' } };
  if (contrato.condominioId && unidade.condominioId !== contrato.condominioId) {
    return { erros: { unidadeId: 'A unidade não pertence ao condomínio deste contrato.' } };
  }

  const anteriores = await prisma.contratoUnidade.findMany({
    where: { contratoId, unidadeId: d.unidadeId, OR: [{ ate: null }, { ate: { gt: toDate(addDays(d.desde, -1)) } }],
    },
  });

  await prisma.$transaction([
    ...anteriores.map((a) =>
      prisma.contratoUnidade.update({ where: { id: a.id }, data: { ate: toDate(addDays(d.desde, -1)), situacao: 'ENCERRADA' } }),
    ),
    prisma.contratoUnidade.create({
      data: {
        contratoId,
        unidadeId: d.unidadeId,
        moradorId: d.moradorId || unidade.titularId || null,
        desde: toDate(d.desde),
        situacao: 'ATIVA',
      },
    }),
  ]);

  revalidatePath(`/contratos/${contratoId}`);
  return {
    mensagem: `${unidade.codigo} aderiu em ${d.desde}${anteriores.length ? ` (adesão anterior encerrada em ${addDays(d.desde, -1)})` : ''}.`,
  };
}

const schemaEncerrarAderencia = z.object({
  ate: dataISO('Até'),
});

export async function encerrarAderencia(
  contratoId: string,
  aderenciaId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaEncerrarAderencia, fd);
  if (!resultado.ok) return { erros: { ate: 'Informe a data de saída.' } };

  const aderencia = await prisma.contratoUnidade.findFirst({
    where: { id: aderenciaId, contratoId },
    include: { unidade: true },
  });
  if (!aderencia) return { erros: { _: 'Adesão não encontrada.' } };
  const desde = aderencia.desde.toISOString().slice(0, 10);
  if (resultado.dados.ate < desde) {
    return { erros: { ate: `A saída não pode ser anterior à adesão (${desde}).` } };
  }

  await prisma.contratoUnidade.update({
    where: { id: aderenciaId },
    data: { ate: toDate(resultado.dados.ate), situacao: 'ENCERRADA' },
  });

  revalidatePath(`/contratos/${contratoId}`);
  return { mensagem: `Adesão de ${aderencia.unidade.codigo} encerrada em ${resultado.dados.ate}.` };
}

export async function gerarCobrancaDoContrato(
  contratoId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const schema = z.object({ competencia: dataISO('Competência') });
  const resultado = validar(schema, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const comp = competencia(resultado.dados.competencia) as Competencia;
  const saida = await gerarCobranca(comp, { contratoIds: [contratoId] });
  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath('/financeiro/contas-a-receber');
  revalidatePath('/financeiro/dashboard');
  revalidatePath('/financeiro/matriz');

  if (saida.criadas === 0) {
    const motivo = saida.puladas[0]?.motivo ?? (saida.jaExistiam ? 'fatura já existe nesta competência' : 'nada a cobrar');
    return { erros: { competencia: `Nenhuma cobrança gerada: ${motivo}.` } };
  }
  return { mensagem: `Fatura e título de ${comp.slice(0, 7)} gerados.` };
}

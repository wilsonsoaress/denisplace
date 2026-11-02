'use server';

import { z } from 'zod';
import { Prisma, type PagamentoContaPagar, type ContaPagar } from '@prisma/client';
import { revalidatePath } from 'next/cache';
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
import { D, brl, money, type Money } from '@/domain/money';
import { competencia, hoje, toDate, toISO, type Competencia, type DateISO } from '@/domain/dates';
import { devidoNaData, estadoQuitacao, type PagamentoResumo } from '@/domain/cobranca';
import { FORMA_PAGAMENTO, CATEGORIA_CONTA_PAGAR } from '@/lib/rotulos';
import { prisma } from '../db';
import { gerarContasPagarDaCompetencia, numeroDaContaPagar } from '../contasPagar/gerar';
import { colunaDuplicada } from '../erros';
import { registrarAuditoria } from '../auditoria';
import { autorizar } from '@/auth/guard';

/**
 * Toda mutacao de lancamento a pagar passa por aqui, espelhando
 * `@/server/acoes/contas`: a tela nao decide se esta pago, quem decide e o
 * estado calculado a partir dos pagamentos registrados.
 */

type ContaPagarCarregada = ContaPagar & { pagamentos: PagamentoContaPagar[] };

function pagamentosValidos(c: { pagamentos: PagamentoContaPagar[] }) {
  return c.pagamentos
    .filter((p) => !p.anulado && !D(p.valor).isZero())
    .map((p) => ({ pagamento: p, valor: money(D(p.valor)), data: toISO(p.data) as DateISO }))
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

function estadoDe(c: ContaPagarCarregada) {
  const pagos = pagamentosValidos(c);
  if (!c.encargoPorAtraso) {
    const recebido = pagos.reduce<Money>((acc, p) => acc.plus(p.valor), D(0));
    const valorOriginal = money(D(c.valorOriginal));
    const pago = recebido.gte(valorOriginal);
    const saldo = money(valorOriginal.minus(recebido));
    return { pago, saldo: saldo.isNegative() ? D(0) : saldo, ultimo: pagos.at(-1) };
  }
  const estado = estadoQuitacao({
    valorOriginal: money(D(c.valorOriginal)),
    vencimento: toISO(c.vencimento) as DateISO,
    pagamentos: pagos.map<PagamentoResumo>((p) => ({ valor: p.valor, data: p.data })),
    hoje: hoje(),
  });
  return { pago: estado.pago, saldo: estado.saldo, ultimo: pagos.at(-1) };
}

async function reaplicarQuitacao(tx: Prisma.TransactionClient, contaPagarId: string): Promise<void> {
  const c = await tx.contaPagar.findUnique({ where: { id: contaPagarId }, include: { pagamentos: true } });
  if (!c) return;
  const { pago, ultimo } = estadoDe(c);
  const quitado = pago && ultimo !== undefined;
  await tx.contaPagar.update({
    where: { id: contaPagarId },
    data: { pago: quitado, pagoEm: quitado ? toDate(ultimo.data) : null, forma: quitado ? ultimo.pagamento.forma : null },
  });
}

function revalidar(contaPagarId: string) {
  revalidatePath('/financeiro/contas-a-pagar');
  revalidatePath(`/financeiro/contas-a-pagar/${contaPagarId}`);
  revalidatePath('/financeiro/dashboard');
}

async function recarregar(contaPagarId: string): Promise<ContaPagarCarregada | null> {
  return prisma.contaPagar.findUnique({ where: { id: contaPagarId }, include: { pagamentos: true } });
}

const FORMAS = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'CHEQUE', 'CARTAO', 'BOLETO', 'OUTRO'] as const;
const CATEGORIAS = ['EQUIPAMENTO', 'INSTALACAO', 'MANUTENCAO', 'COMISSAO', 'FRETE', 'TAXA', 'OUTRO'] as const;

const schemaLancamento = z.object({
  fornecedorNome: obrigatorio('Fornecedor', 200),
  categoria: enumDe('Categoria', CATEGORIAS),
  descricao: obrigatorio('Descrição', 300),
  competencia: dataISO('Competência'),
  valorOriginal: decimal('Valor'),
  vencimento: dataISO('Vencimento'),
  encargoPorAtraso: z.union([z.literal('0'), z.literal('1')]).default('0'),
  recorrente: z.union([z.literal('0'), z.literal('1')]).default('0'),
  contratoId: opcional(60),
  ordemServicoId: opcional(60),
  observacoes: opcional(1000),
});

/**
 * Cria um lancamento pontual ou o "modelo" de um recorrente — o primeiro mes
 * ja nasce como lancamento de verdade, os seguintes saem de
 * `gerarContasPagarDaCompetencia` apontando de volta para este.
 */
export async function registrarContaPagar(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schemaLancamento, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const comp = competencia(d.competencia) as Competencia;
  if (d.vencimento < comp) {
    return { erros: { vencimento: 'O vencimento não pode ser anterior ao primeiro dia da competência.' } };
  }

  try {
    const criado = await prisma.$transaction(async (tx) => {
      const quantos = await tx.contaPagar.count({
        where: { competencia: { gte: new Date(`${comp}T00:00:00.000Z`), lte: new Date(`${comp}T23:59:59.999Z`) } },
      });
      return tx.contaPagar.create({
        data: {
          numero: numeroDaContaPagar(comp, quantos + 1),
          fornecedorNome: d.fornecedorNome,
          categoria: d.categoria,
          descricao: d.descricao,
          competencia: toDate(comp),
          valorOriginal: money(D(d.valorOriginal)),
          vencimento: toDate(d.vencimento),
          encargoPorAtraso: d.encargoPorAtraso === '1',
          recorrente: d.recorrente === '1',
          contratoId: d.contratoId || null,
          ordemServicoId: d.ordemServicoId || null,
          observacoes: d.observacoes || null,
        },
      });
    });

    await registrarAuditoria(acesso.usuario, {
      acao: 'contaPagar.criar',
      entidade: 'contaPagar',
      entidadeId: criado.id,
      resumo: `${criado.numero} · ${d.fornecedorNome} · ${CATEGORIA_CONTA_PAGAR[d.categoria]} · ${brl(d.valorOriginal)}${
        d.recorrente === '1' ? ' · recorrente' : ''
      }`,
    });
    revalidatePath('/financeiro/contas-a-pagar');
    revalidatePath('/financeiro/dashboard');
    return {
      mensagem: `Lançamento ${criado.numero} registrado${d.recorrente === '1' ? '. Use "Gerar contas a pagar do mês" para criar os meses seguintes.' : '.'}`,
    };
  } catch (erro) {
    if (colunaDuplicada(erro)) {
      return { erros: { _: 'Este número já existe. Tente novamente.' } };
    }
    throw erro;
  }
}

const schemaPagamento = z.object({
  data: dataISO('Data do pagamento'),
  forma: enumDe('Forma de pagamento', FORMAS),
  valor: decimalOpcional('Valor pago'),
  comprovanteUrl: opcional(500),
  observacao: opcional(500),
});

export async function registrarPagamentoContaPagar(
  contaPagarId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaPagamento, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const c = await recarregar(contaPagarId);
  if (!c) return { erros: { _: 'Lançamento não encontrado.' } };
  if (c.pago) return { erros: { data: 'Este lançamento já está quitado. Use o estorno para corrigir.' } };
  if (d.data > hoje()) return { erros: { data: 'A data do pagamento não pode ser futura.' } };

  const vencimento = toISO(c.vencimento) as DateISO;
  const devidoNestaData = c.encargoPorAtraso
    ? devidoNaData(money(D(c.valorOriginal)), vencimento, d.data)
    : money(D(c.valorOriginal));
  const pago = pagamentosValidos(c).reduce<Money>((acc, p) => acc.plus(p.valor), D(0));
  const valor = d.valor ? money(D(d.valor)) : money(devidoNestaData.minus(pago));

  if (valor.lte(0)) {
    return {
      erros: { valor: `Os pagamentos já cobrem os ${brl(devidoNestaData)} devidos. Registre um valor menor, se foi parcial.` },
    };
  }
  if (valor.plus(pago).gt(devidoNestaData)) {
    return {
      erros: {
        valor: `Passa do devido (${brl(devidoNestaData)}). Já foram pagos ${brl(pago)}; o máximo agora é ${brl(money(devidoNestaData.minus(pago)))}.`,
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.pagamentoContaPagar.create({
      data: {
        contaPagarId,
        valor,
        data: toDate(d.data),
        forma: d.forma,
        comprovanteUrl: d.comprovanteUrl || null,
        observacao: d.observacao || null,
        usuarioId: acesso.usuario.id,
      },
    });
    await reaplicarQuitacao(tx, contaPagarId);
  });

  await registrarAuditoria(acesso.usuario, {
    acao: 'contaPagar.pagamento',
    entidade: 'contaPagar',
    entidadeId: contaPagarId,
    resumo: `${brl(valor)} em ${d.data} (${FORMA_PAGAMENTO[d.forma]})`,
  });
  revalidar(contaPagarId);
  return { mensagem: `Pagamento de ${brl(valor)} registrado em ${d.data}.` };
}

const schemaEstorno = z.object({ motivo: obrigatorio('Motivo do estorno', 500) });

export async function estornarPagamentoContaPagar(
  contaPagarId: string,
  pagamentoId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaEstorno, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const pagamento = await prisma.pagamentoContaPagar.findFirst({ where: { id: pagamentoId, contaPagarId } });
  if (!pagamento) return { erros: { motivo: 'Pagamento não encontrado neste lançamento.' } };
  if (pagamento.anulado) return { erros: { motivo: 'Este pagamento já foi estornado.' } };

  await prisma.$transaction(async (tx) => {
    await tx.pagamentoContaPagar.update({
      where: { id: pagamentoId },
      data: { anulado: true, anuladoEm: toDate(hoje()), anuladoMotivo: resultado.dados.motivo },
    });
    await reaplicarQuitacao(tx, contaPagarId);
  });

  await registrarAuditoria(acesso.usuario, {
    acao: 'contaPagar.estorno',
    entidade: 'contaPagar',
    entidadeId: contaPagarId,
    resumo: `estorno de ${brl(pagamento.valor)} (${toISO(pagamento.data)}): ${resultado.dados.motivo}`,
  });
  revalidar(contaPagarId);
  return { mensagem: `Pagamento de ${brl(pagamento.valor)} estornado.` };
}

function idsSelecionados(fd: FormData): string[] {
  const saida = new Set<string>();
  for (const valor of fd.getAll('ids')) {
    if (typeof valor === 'string' && valor.trim() !== '') saida.add(valor.trim());
  }
  return [...saida];
}

const schemaNf = z.object({ numero: opcional(60) });

/** Emissao manual de NF de entrada, individual ou em lote — sem integracao bancaria. */
export async function marcarNfRecebida(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schemaNf, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const { numero } = resultado.dados;

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const ids = idsSelecionados(fd);
  if (ids.length === 0) {
    return { erros: { _: 'Nenhum lançamento selecionado. Marque as linhas da grade antes.' } };
  }
  if (ids.length > 1 && numero) {
    return { erros: { numero: 'O número da NF é por lançamento: em lote deixe vazio e ajuste na tela do lançamento.' } };
  }

  const lancamentos = await prisma.contaPagar.findMany({ where: { id: { in: ids } } });
  if (lancamentos.length !== ids.length) {
    return { erros: { _: 'Um dos lançamentos selecionados não existe mais. Recarregue a grade.' } };
  }

  const recebidoEm = toDate(hoje());
  await prisma.contaPagar.updateMany({
    where: { id: { in: ids } },
    data: { nfRecebida: true, nfRecebidaEm: recebidoEm, ...(numero ? { nfNumero: numero } : {}) },
  });

  await registrarAuditoria(acesso.usuario, {
    acao: 'contaPagar.nf',
    entidade: 'contaPagar',
    entidadeId: lancamentos[0]?.id ?? '',
    resumo: `NF de entrada registrada em lote de ${lancamentos.length} lançamento(s)`,
  });
  revalidatePath('/financeiro/contas-a-pagar');
  revalidatePath('/financeiro/dashboard');
  return { mensagem: `${lancamentos.length} lançamento(s) marcados com NF de entrada recebida.` };
}

export async function desmarcarNfRecebida(contaPagarId: string) {
  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return;
  await prisma.contaPagar.update({
    where: { id: contaPagarId },
    data: { nfRecebida: false, nfRecebidaEm: null, nfNumero: null },
  });
  await registrarAuditoria(acesso.usuario, {
    acao: 'contaPagar.nf.estorno',
    entidade: 'contaPagar',
    entidadeId: contaPagarId,
    resumo: 'registro de NF de entrada desmarcado',
  });
  revalidar(contaPagarId);
}

const schemaBaixaLote = z.object({
  data: dataISO('Data do pagamento'),
  forma: enumDe('Forma de pagamento', FORMAS),
});

/** Baixa em lote: cada lançamento recebe o que deve na data informada. */
export async function registrarPagamentoContaPagarEmLote(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schemaBaixaLote, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const { data, forma } = resultado.dados;

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const ids = idsSelecionados(fd);
  if (ids.length === 0) {
    return { erros: { _: 'Nenhum lançamento selecionado. Marque as linhas da grade antes de dar a baixa.' } };
  }
  if (data > hoje()) return { erros: { data: 'A data do pagamento não pode ser futura.' } };

  const lancamentos = await prisma.contaPagar.findMany({ where: { id: { in: ids } }, include: { pagamentos: true } });
  if (lancamentos.length !== ids.length) {
    return { erros: { _: 'Um dos lançamentos selecionados não existe mais. Recarregue a grade.' } };
  }
  const jaQuitados = lancamentos.filter((c) => c.pago);
  if (jaQuitados.length > 0) {
    const exemplos = jaQuitados.slice(0, 5).map((c) => c.numero).join(', ');
    return {
      erros: { _: `A baixa em lote não aceita linhas já quitadas (ex: ${exemplos}). Desmarque essas linhas.` },
    };
  }

  const baixas: { contaPagarId: string; numero: string; valor: Money }[] = [];
  for (const c of lancamentos) {
    const vencimento = toISO(c.vencimento) as DateISO;
    const devido = c.encargoPorAtraso ? devidoNaData(money(D(c.valorOriginal)), vencimento, data) : money(D(c.valorOriginal));
    const pago = pagamentosValidos(c).reduce<Money>((acc, p) => acc.plus(p.valor), D(0));
    const valor = money(devido.minus(pago));
    if (valor.lte(0)) {
      return { erros: { _: `O lançamento ${c.numero} já tem ${brl(pago)} registrados e nada a pagar em ${data}. Desmarque esta linha.` } };
    }
    baixas.push({ contaPagarId: c.id, numero: c.numero, valor });
  }

  const total = baixas.reduce<Money>((acc, b) => acc.plus(b.valor), D(0));
  await prisma.$transaction(async (tx) => {
    for (const b of baixas) {
      await tx.pagamentoContaPagar.create({
        data: { contaPagarId: b.contaPagarId, valor: b.valor, data: toDate(data), forma, usuarioId: acesso.usuario.id },
      });
      await reaplicarQuitacao(tx, b.contaPagarId);
    }
  });

  for (const b of baixas) {
    await registrarAuditoria(acesso.usuario, {
      acao: 'contaPagar.pagamento',
      entidade: 'contaPagar',
      entidadeId: b.contaPagarId,
      resumo: `${brl(b.valor)} em ${data} (${FORMA_PAGAMENTO[forma]}) · baixa em lote de ${baixas.length} lançamento(s)`,
    });
    revalidatePath(`/financeiro/contas-a-pagar/${b.contaPagarId}`);
  }
  revalidatePath('/financeiro/contas-a-pagar');
  revalidatePath('/financeiro/dashboard');

  return { mensagem: `Baixa registrada em ${baixas.length} lançamento(s) na data ${data} (${FORMA_PAGAMENTO[forma]}): ${brl(total)}.` };
}

/** A grade tem um formulario so: o botao clicado diz se o lote e de NF ou de baixa. */
export async function aplicarLoteDaGradePagar(prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return fd.get('tipo') === 'PAGAMENTO' ? registrarPagamentoContaPagarEmLote(prev, fd) : marcarNfRecebida(prev, fd);
}

const schemaGeracao = z.object({ competencia: dataISO('Competência') });

/** Gera a proxima competencia de todo lancamento recorrente, num so disparo. */
export async function gerarContasPagarDaCompetenciaAction(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const resultado = validar(schemaGeracao, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const comp = competencia(resultado.dados.competencia) as Competencia;
  const saida = await gerarContasPagarDaCompetencia(comp);

  await registrarAuditoria(acesso.usuario, {
    acao: 'contaPagar.gerar',
    entidade: 'competencia',
    entidadeId: comp,
    resumo: `geração em lote da competência ${comp.slice(0, 7)}: ${saida.criadas} lançamento(s) recorrente(s), ${saida.jaExistiam} já existente(s)`,
  });

  revalidatePath('/financeiro/contas-a-pagar');
  revalidatePath('/financeiro/dashboard');

  if (saida.criadas === 0) {
    if (saida.jaExistiam > 0) {
      return { mensagem: `Nada a gerar: os ${saida.jaExistiam} lançamento(s) recorrente(s) de ${comp.slice(0, 7)} já existem.` };
    }
    return { erros: { competencia: `Nenhum lançamento recorrente cadastrado para gerar em ${comp.slice(0, 7)}.` } };
  }
  return {
    mensagem: `Competência ${comp.slice(0, 7)}: ${saida.criadas} lançamento(s) recorrente(s) gerados${
      saida.jaExistiam > 0 ? `, ${saida.jaExistiam} já existia(m)` : ''
    }.`,
  };
}

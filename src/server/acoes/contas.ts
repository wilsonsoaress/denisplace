'use server';

import { z } from 'zod';
import { Prisma, type Pagamento, type Titulo } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { dataISO, decimalOpcional, enumDe, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { D, brl, money, type Money } from '@/domain/money';
import { competencia, hoje, toDate, toISO, type Competencia, type DateISO } from '@/domain/dates';
import { devidoNaData, estadoQuitacao, type PagamentoResumo } from '@/domain/cobranca';
import { FORMA_PAGAMENTO, TIPO_EMISSAO } from '@/lib/rotulos';
import { prisma } from '../db';
import { gerarCobranca } from '../cobranca/gerar';
import { colunaDuplicada } from '../erros';
import { registrarAuditoria } from '../auditoria';
import { autorizar } from '@/auth/guard';

/**
 * Toda mutacao de titulo passa por aqui. A tela nao decide se o titulo esta pago:
 * quem decide e `estadoQuitacao`, recalculado a partir dos pagamentos registrados.
 * Assim pagamento parcial, estorno e grade falam o mesmo numero que o banco.
 */

type TituloCarregado = Titulo & { pagamentos: Pagamento[] };

type PagamentoValido = { pagamento: Pagamento; valor: Money; data: DateISO };

function pagamentosValidos(t: { pagamentos: Pagamento[] }): PagamentoValido[] {
  return t.pagamentos
    .filter((p) => !p.anulado && !D(p.valor).isZero())
    .map((p) => ({ pagamento: p, valor: money(D(p.valor)), data: toISO(p.data) as DateISO }))
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

function estadoDo(t: TituloCarregado) {
  const pagos = pagamentosValidos(t);
  const estado = estadoQuitacao({
    valorOriginal: money(D(t.valorOriginal)),
    vencimento: toISO(t.vencimento) as DateISO,
    pagamentos: pagos.map<PagamentoResumo>((p) => ({ valor: p.valor, data: p.data })),
    hoje: hoje(),
  });
  return { estado, pagos, ultimo: pagos.at(-1) };
}

/** Reescreve pago/pagoEm/forma do titulo a partir dos pagamentos ainda validos. */
async function reaplicarQuitacao(
  tx: Prisma.TransactionClient,
  tituloId: string,
): Promise<void> {
  const t = await tx.titulo.findUnique({ where: { id: tituloId }, include: { pagamentos: true } });
  if (!t) return;
  const { estado, ultimo } = estadoDo(t);
  const pago = estado.pago && ultimo !== undefined;
  await tx.titulo.update({
    where: { id: tituloId },
    data: { pago, pagoEm: pago ? toDate(ultimo.data) : null, forma: pago ? ultimo.pagamento.forma : null },
  });
}

function revalidar(tituloId: string) {
  revalidatePath('/financeiro/contas-a-receber');
  revalidatePath(`/financeiro/contas-a-receber/${tituloId}`);
  // Criterio de aceite da F1: dar baixa na grade e ver dashboard e matriz mudarem na mesma sessao.
  revalidatePath('/financeiro/dashboard');
  revalidatePath('/financeiro/matriz');
}

async function recarregar(tituloId: string): Promise<TituloCarregado | null> {
  return prisma.titulo.findUnique({ where: { id: tituloId }, include: { pagamentos: true } });
}

const FORMAS = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'CHEQUE', 'CARTAO', 'BOLETO', 'OUTRO'] as const;

const schemaPagamento = z.object({
  data: dataISO('Data do pagamento'),
  forma: enumDe('Forma de pagamento', FORMAS),
  valor: decimalOpcional('Valor recebido'),
  comprovanteUrl: opcional(500),
  observacao: opcional(500),
});

/**
 * Valor em branco = quitacao total, calculada pela data informada: os acrescimos
 * param de correr no dia em que a pessoa pagou, nao no dia em que a tela foi aberta.
 */
export async function registrarPagamento(
  tituloId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaPagamento, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const t = await recarregar(tituloId);
  if (!t) return { erros: { _: 'Título não encontrado.' } };
  if (t.pago) return { erros: { data: 'Este título já está quitado. Use o estorno do pagamento para corrigir.' } };
  if (t.isento) {
    return { erros: { data: 'Título isento não recebe pagamento. Retire a isenção antes, se a cobrança voltou a valer.' } };
  }
  if (d.data > hoje()) return { erros: { data: 'A data do pagamento não pode ser futura.' } };

  const vencimento = toISO(t.vencimento) as DateISO;
  const devidoNestaData = devidoNaData(money(D(t.valorOriginal)), vencimento, d.data);
  const recebido = pagamentosValidos(t).reduce<Money>((acc, p) => acc.plus(p.valor), D(0));
  // Em branco = quitar o que falta NA DATA informada, não o valor cheio da fatura.
  const valor = d.valor ? money(D(d.valor)) : money(devidoNestaData.minus(recebido));

  if (valor.lte(0)) {
    return {
      erros: {
        valor: `Os pagamentos registrados já cobrem os ${brl(devidoNestaData)} devidos em ${d.data}. Registre um valor menor, se a quitação foi parcial.`,
      },
    };
  }
  if (valor.plus(recebido).gt(devidoNestaData)) {
    return {
      erros: {
        valor: `Passa do devido em ${d.data} (${brl(devidoNestaData)}). Já foram registrados ${brl(recebido)}; o máximo agora é ${brl(money(devidoNestaData.minus(recebido)))}.`,
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.pagamento.create({
      data: {
        tituloId,
        valor,
        data: toDate(d.data),
        forma: d.forma,
        comprovanteUrl: d.comprovanteUrl || null,
        observacao: d.observacao || null,
        usuarioId: acesso.usuario.id,
      },
    });
    await reaplicarQuitacao(tx, tituloId);
  });

  const depois = await recarregar(tituloId);
  const final = depois ? estadoDo(depois) : null;
  await registrarAuditoria(acesso.usuario, {
    acao: 'titulo.pagamento',
    entidade: 'titulo',
    entidadeId: tituloId,
    resumo: `${brl(valor)} em ${d.data} (${FORMA_PAGAMENTO[d.forma]}) · ${
      final?.estado.pago ? 'quitado' : `saldo ${brl(final ? final.estado.saldo : D(0))}`
    }`,
  });
  revalidar(tituloId);

  if (!final) return { mensagem: `Pagamento de ${brl(valor)} registrado em ${d.data}.` };
  if (final.estado.pago) {
    return {
      mensagem: `Pagamento de ${brl(valor)} em ${d.data} (${FORMA_PAGAMENTO[d.forma]}): título quitado${
        vencimento < d.data ? ', com multa e juros calculados até a data do pagamento' : ''
      }.`,
    };
  }
  return {
    mensagem: `Pagamento parcial de ${brl(valor)} em ${d.data}. Saldo em aberto: ${brl(final.estado.saldo)}.`,
  };
}

const schemaEstorno = z.object({ motivo: obrigatorio('Motivo do estorno', 500) });

/**
 * Estorno anula o pagamento em vez de apagar: o valor continua na tabela, com
 * `anuladoEm` e o motivo, porque receber e depois estornar e um fato que o
 * financeiro precisa poder provar na conciliação.
 */
export async function estornarPagamento(
  tituloId: string,
  pagamentoId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaEstorno, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const pagamento = await prisma.pagamento.findFirst({
    where: { id: pagamentoId, tituloId },
  });
  if (!pagamento) return { erros: { motivo: 'Pagamento não encontrado neste título.' } };
  if (pagamento.anulado) return { erros: { motivo: 'Este pagamento já foi estornado.' } };

  await prisma.$transaction(async (tx) => {
    await tx.pagamento.update({
      where: { id: pagamentoId },
      data: { anulado: true, anuladoEm: toDate(hoje()), anuladoMotivo: resultado.dados.motivo },
    });
    await reaplicarQuitacao(tx, tituloId);
  });

  const depois = await recarregar(tituloId);
  const final = depois ? estadoDo(depois) : null;
  await registrarAuditoria(acesso.usuario, {
    acao: 'titulo.estorno',
    entidade: 'titulo',
    entidadeId: tituloId,
    resumo: `estorno de ${brl(pagamento.valor)} (${toISO(pagamento.data)}): ${resultado.dados.motivo}`,
  });
  revalidar(tituloId);

  if (!final) return { mensagem: `Pagamento de ${brl(pagamento.valor)} estornado.` };
  return {
    mensagem: final.estado.pago
      ? `Pagamento de ${brl(pagamento.valor)} estornado; os pagamentos restantes ainda quitam o título.`
      : `Pagamento de ${brl(pagamento.valor)} estornado. Saldo em aberto: ${brl(final.estado.saldo)}.`,
  };
}

const schemaIsencao = z.object({ motivo: obrigatorio('Motivo da isenção', 500) });

/**
 * Isencao tira o titulo da adimplencia (numerador e denominador), por isso a
 * justificativa e obrigatoria: sem ela o indice melhoraria sem ninguem pagar.
 */
export async function marcarIsento(
  tituloId: string,
  _prev: EstadoForm,
  fd: FormData,
): Promise<EstadoForm> {
  const resultado = validar(schemaIsencao, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const t = await recarregar(tituloId);
  if (!t) return { erros: { motivo: 'Título não encontrado.' } };
  if (t.pago) return { erros: { motivo: 'Título quitado não pode virar isento. Estorne o pagamento primeiro.' } };

  await prisma.titulo.update({
    where: { id: tituloId },
    data: { isento: true, isentoMotivo: resultado.dados.motivo },
  });
  await registrarAuditoria(acesso.usuario, {
    acao: 'titulo.isencao',
    entidade: 'titulo',
    entidadeId: tituloId,
    resumo: `isento: ${resultado.dados.motivo}`,
  });
  revalidar(tituloId);
  return { mensagem: 'Título marcado como isento: ele sai do cálculo de adimplência e da receita recorrente.' };
}

export async function retirarIsencao(tituloId: string) {
  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return;
  await prisma.titulo.update({ where: { id: tituloId }, data: { isento: false, isentoMotivo: null } });
  await registrarAuditoria(acesso.usuario, {
    acao: 'titulo.isencao.retirada',
    entidade: 'titulo',
    entidadeId: tituloId,
    resumo: 'isenção retirada: o título volta a contar na adimplência',
  });
  revalidar(tituloId);
}

const TIPOS_EMISSAO = ['BOLETO', 'NF', 'SEGUNDA_VIA'] as const;

const schemaEmissao = z.object({
  tipo: enumDe('Tipo de emissão', TIPOS_EMISSAO),
  numero: opcional(60),
});

function idsSelecionados(fd: FormData): string[] {
  const saida = new Set<string>();
  for (const valor of fd.getAll('ids')) {
    if (typeof valor === 'string' && valor.trim() !== '') saida.add(valor.trim());
  }
  return [...saida];
}

/**
 * Emissao manual, em lote ou de um titulo sozinho. Cada disparo cria um
 * `EmissaoLote` com o que foi gerado e quando: sem integracao bancaria, essa e a
 * unica prova de "este boleto ja saiu?".
 */
export async function marcarEmitido(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schemaEmissao, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const { tipo, numero } = resultado.dados;

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const ids = idsSelecionados(fd);
  if (ids.length === 0) {
    return { erros: { _: 'Nenhum título selecionado. Marque as linhas da grade antes de emitir.' } };
  }
  if (ids.length > 1 && numero) {
    return { erros: { numero: 'O número é por título: em lote deixe este campo vazio e ajuste na tela do título.' } };
  }

  const titulos = await prisma.titulo.findMany({ where: { id: { in: ids } } });
  if (titulos.length !== ids.length) {
    return { erros: { _: 'Um dos títulos selecionados não existe mais. Recarregue a grade.' } };
  }
  if (tipo === 'SEGUNDA_VIA') {
    const semBoleto = titulos.filter((t) => !t.boletoGerado).length;
    if (semBoleto > 0) {
      return {
        erros: { _: `${semBoleto} de ${titulos.length} título(s) ainda sem 1ª via: segunda via exige a emissão anterior.` },
      };
    }
  }

  const maisAntiga = titulos
    .map((t) => toISO(t.competencia) as DateISO)
    .sort()[0] as DateISO;
  const comp = competencia(maisAntiga) as Competencia;
  const valorTotal = money(titulos.reduce<Money>((acc, t) => acc.plus(money(D(t.valorOriginal))), D(0)));
  const emitidoEm = toDate(hoje());

  try {
    await prisma.$transaction(async (tx) => {
      const lote = await tx.emissaoLote.create({
        data: {
          tipo,
          competencia: toDate(comp),
          descricao: `${TIPO_EMISSAO[tipo]} de ${titulos.length} título(s) · competência ${comp.slice(0, 7)}`,
          quantidade: titulos.length,
          valorTotal,
          usuarioId: acesso.usuario.id,
        },
      });
      await tx.emissaoLoteTitulo.createMany({ data: titulos.map((t) => ({ loteId: lote.id, tituloId: t.id })) });

      const dados =
        tipo === 'NF'
          ? { nfEmitida: true, nfEmissaoEm: emitidoEm, ...(numero ? { nfNumero: numero } : {}) }
          : { boletoGerado: true, boletoEmitidoEm: emitidoEm, ...(numero ? { nossoNumero: numero } : {}) };
      for (const t of titulos) {
        await tx.titulo.update({ where: { id: t.id }, data: dados });
      }
    });
  } catch (erro) {
    if (colunaDuplicada(erro)) {
      return { erros: { _: 'Esta emissão acabou de ser registrada por outra pessoa. Recarregue a grade.' } };
    }
    throw erro;
  }

  await registrarAuditoria(acesso.usuario, {
    acao: 'titulo.emissao',
    entidade: 'titulo',
    entidadeId: titulos[0]?.id ?? '',
    resumo: `${TIPO_EMISSAO[tipo]} em lote de ${titulos.length} título(s) · ${brl(valorTotal)} · competência ${comp.slice(0, 7)}`,
  });
  revalidatePath('/financeiro/contas-a-receber');
  revalidatePath('/financeiro/dashboard');
  return {
    mensagem: `${TIPO_EMISSAO[tipo]}: ${titulos.length} título(s) marcados como emitidos hoje (${brl(valorTotal)}).`,
  };
}

const schemaBaixaLote = z.object({
  data: dataISO('Data do pagamento'),
  forma: enumDe('Forma de pagamento', FORMAS),
});

/**
 * Baixa em lote: cada titulo recebe o que deve na data informada, por isso o
 * valor nao e campo do lote — um numero unico quitaria de menos quem esta em
 * atraso e a mais quem ainda nem venceu.
 */
export async function registrarPagamentoEmLote(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schemaBaixaLote, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const { data, forma } = resultado.dados;

  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const ids = idsSelecionados(fd);
  if (ids.length === 0) {
    return { erros: { _: 'Nenhum título selecionado. Marque as linhas da grade antes de dar a baixa.' } };
  }
  if (data > hoje()) return { erros: { data: 'A data do pagamento não pode ser futura.' } };

  const titulos = await prisma.titulo.findMany({ where: { id: { in: ids } }, include: { pagamentos: true } });
  if (titulos.length !== ids.length) {
    return { erros: { _: 'Um dos títulos selecionados não existe mais. Recarregue a grade.' } };
  }

  const jaQuitados = titulos.filter((t) => t.pago);
  const isentos = titulos.filter((t) => t.isento && !t.pago);
  if (jaQuitados.length > 0 || isentos.length > 0) {
    const exemplos = [...jaQuitados, ...isentos].slice(0, 5).map((t) => t.numero).join(', ');
    const partes = [
      jaQuitados.length > 0 ? `${jaQuitados.length} já quitado(s)` : null,
      isentos.length > 0 ? `${isentos.length} isento(s)` : null,
    ].filter(Boolean);
    return {
      erros: {
        _: `A baixa em lote não aceita mistura: ${partes.join(' e ')} (ex: ${exemplos}). Desmarque essas linhas — quitação se corrige pelo estorno na tela do título, e isento só volta a pagar com a isenção retirada.`,
      },
    };
  }

  const baixas: { tituloId: string; numero: string; valor: Money }[] = [];
  for (const t of titulos) {
    const vencimento = toISO(t.vencimento) as DateISO;
    const devido = devidoNaData(money(D(t.valorOriginal)), vencimento, data);
    const recebido = pagamentosValidos(t).reduce<Money>((acc, p) => acc.plus(p.valor), D(0));
    const valor = money(devido.minus(recebido));
    if (valor.lte(0)) {
      return {
        erros: {
          _: `O título ${t.numero} já tem ${brl(recebido)} registrados e nada a pagar em ${data}. Desmarque esta linha.`,
        },
      };
    }
    baixas.push({ tituloId: t.id, numero: t.numero, valor });
  }

  const total = baixas.reduce<Money>((acc, b) => acc.plus(b.valor), D(0));
  await prisma.$transaction(async (tx) => {
    for (const b of baixas) {
      await tx.pagamento.create({
        data: { tituloId: b.tituloId, valor: b.valor, data: toDate(data), forma, usuarioId: acesso.usuario.id },
      });
      await reaplicarQuitacao(tx, b.tituloId);
    }
  });

  for (const b of baixas) {
    await registrarAuditoria(acesso.usuario, {
      acao: 'titulo.pagamento',
      entidade: 'titulo',
      entidadeId: b.tituloId,
      resumo: `${brl(b.valor)} em ${data} (${FORMA_PAGAMENTO[forma]}) · baixa em lote de ${baixas.length} título(s)`,
    });
    revalidatePath(`/financeiro/contas-a-receber/${b.tituloId}`);
  }
  revalidatePath('/financeiro/contas-a-receber');
  revalidatePath('/financeiro/dashboard');
  revalidatePath('/financeiro/matriz');

  return {
    mensagem: `Baixa registrada em ${baixas.length} título(s) na data ${data} (${FORMA_PAGAMENTO[forma]}): ${brl(total)}. Multa e juros calculados até essa data.`,
  };
}

/**
 * A grade tem um formulario so porque as linhas selecionadas pertencem ao lote:
 * o botao clicado diz se o lote e de emissao ou de baixa.
 */
export async function aplicarLoteDaGrade(prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return fd.get('tipo') === 'PAGAMENTO' ? registrarPagamentoEmLote(prev, fd) : marcarEmitido(prev, fd);
}

const schemaGeracao = z.object({ competencia: dataISO('Competência') });

/**
 * Gera a competencia inteira num disparo, sobre todos os contratos vigentes.
 * O job mensal ja faz isso, mas ele roda na data do calendario: aqui o
 * financeiro antecipa ou reprocessa um mes e ve o resultado na grade.
 * Idempotente por (contrato, competencia), entao repetir nao duplica cobranca.
 */
export async function gerarCobrancaDaCompetencia(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return acesso;

  const resultado = validar(schemaGeracao, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const comp = competencia(resultado.dados.competencia) as Competencia;
  const saida = await gerarCobranca(comp);

  await registrarAuditoria(acesso.usuario, {
    acao: 'cobranca.gerar',
    entidade: 'competencia',
    entidadeId: comp,
    resumo: `geração em lote da competência ${comp.slice(0, 7)}: ${saida.criadas} fatura(s), ${saida.jaExistiam} já existente(s), ${saida.puladas.length} pulada(s)${
      saida.puladas.length > 0 ? ` (${saida.puladas.map((p) => `#${p.contrato}: ${p.motivo}`).join('; ')})` : ''
    }`,
  });

  revalidatePath('/financeiro/contas-a-receber');
  revalidatePath('/financeiro/dashboard');
  revalidatePath('/financeiro/matriz');

  if (saida.criadas === 0) {
    if (saida.jaExistiam > 0) {
      return { mensagem: `Nada a gerar: as ${saida.jaExistiam} fatura(s) de ${comp.slice(0, 7)} já existem.${saida.puladas.length > 0 ? ` ${saida.puladas.length} contrato(s) pulado(s).` : ''}` };
    }
    const motivos = [...new Set(saida.puladas.map((p) => p.motivo))].join(' / ');
    return {
      erros: {
        competencia: `Nenhuma cobrança gerada em ${comp.slice(0, 7)}${saida.puladas.length > 0 ? `: ${saida.puladas.length} contrato(s) fora do corte (${motivos})` : ': nenhum contrato vigente neste mês'}${saida.puladas.length > 0 ? '. Verifique a vigência na tela do contrato.' : '.'}`,
      },
    };
  }
  return {
    mensagem: `Competência ${comp.slice(0, 7)}: ${saida.criadas} fatura(s) e título(s) gerados${
      saida.jaExistiam > 0 ? `, ${saida.jaExistiam} já existia(m)` : ''
    }${saida.puladas.length > 0 ? `, ${saida.puladas.length} contrato(s) pulado(s)` : ''}.`,
  };
}

/**
 * Estorno da emissao: desmarca o controle de um titulo marcado por engano. Nao
 * apaga o lote anterior, que continua sendo a prova da emissão equivocada.
 */
export async function desmarcarEmitido(tituloId: string, campo: 'boleto' | 'nf') {
  const acesso = await autorizar('financeiro');
  if (!('usuario' in acesso)) return;
  await prisma.titulo.update({
    where: { id: tituloId },
    data:
      campo === 'boleto'
        ? { boletoGerado: false, boletoEmitidoEm: null, nossoNumero: null }
        : { nfEmitida: false, nfEmissaoEm: null, nfNumero: null },
  });
  await registrarAuditoria(acesso.usuario, {
    acao: 'titulo.emissao.estorno',
    entidade: 'titulo',
    entidadeId: tituloId,
    resumo: `emissão de ${campo === 'boleto' ? 'boleto' : 'NF'} desmarcada`,
  });
  revalidar(tituloId);
}

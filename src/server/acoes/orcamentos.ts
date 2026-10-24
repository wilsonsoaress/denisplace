'use server';

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dataISO, dataOpcional, decimalOpcional, enumDe, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { D, brl, money, sum, type Money } from '@/domain/money';
import { addMonths, competencia, hoje, toDate, toISO } from '@/domain/dates';
import { prisma } from '../db';
import { autorizar } from '@/auth/guard';
import { registrarAuditoria } from '../auditoria';
import { colunaDuplicada } from '../erros';

/**
 * O orcamento e a unica entrada de negocio: ao converter, item PONTUAL vira OS e
 * item RECORRENTE vira contrato + item de contrato. A origem fica gravada em
 * `Orcamento.contratoId`, e e por ela que a taxa de conversao da F1 e medida.
 */

const schemaOrcamento = z.object({
  clienteId: obrigatorio('Cliente', 40),
  condominioId: opcional(40),
  titulo: obrigatorio('Título', 120),
  descricao: opcional(2000),
  validade: dataISO('Validade'),
});

/** Edição livre só até o orçamento virar fato aprovado: depois disso a conversa muda. */
const EDITAVEL = ['ABERTO', 'ENVIADO'] as const;

function paraBanco(d: z.infer<typeof schemaOrcamento>) {
  return {
    clienteId: d.clienteId,
    condominioId: d.condominioId || null,
    titulo: d.titulo,
    descricao: d.descricao || null,
    validade: toDate(d.validade),
  };
}

async function totalDosItens(c: Pick<Prisma.TransactionClient, 'orcamentoItem'>, orcamentoId: string): Promise<Money> {
  const itens = await c.orcamentoItem.findMany({ where: { orcamentoId }, select: { total: true } });
  return money(sum(...itens.map((i) => D(i.total))));
}

function revalidar(id: string) {
  revalidatePath('/orcamentos');
  revalidatePath(`/orcamentos/${id}`);
}

export async function criarOrcamento(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('orcamentos');
  if (!('usuario' in acesso)) return acesso;
  const resultado = validar(schemaOrcamento, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  try {
    const ultimo = await prisma.orcamento.aggregate({ _max: { numero: true } });
    const orcamento = await prisma.orcamento.create({
      data: {
        ...paraBanco(resultado.dados),
        numero: (ultimo._max.numero ?? 0) + 1,
        status: 'ABERTO',
      },
    });
    revalidatePath('/orcamentos');
    redirect(`/orcamentos/${orcamento.id}?criado=1`);
  } catch (erro) {
    if (colunaDuplicada(erro)) return { erros: { _: 'O orçamento já foi criado neste instante. Recarregue a lista.' } };
    throw erro;
  }
}

export async function salvarOrcamento(id: string, _prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('orcamentos');
  if (!('usuario' in acesso)) return acesso;
  const resultado = validar(schemaOrcamento, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  const atual = await prisma.orcamento.findUnique({ where: { id }, select: { status: true } });
  if (!atual) return { erros: { _: 'Orçamento não encontrado.' } };
  if (!(EDITAVEL as readonly string[]).includes(atual.status)) {
    return { erros: { _: `Orçamento ${atual.status.toLowerCase()} não pode mais ser editado: a conversão congela as condições.` } };
  }

  await prisma.orcamento.update({ where: { id }, data: paraBanco(resultado.dados) });
  revalidar(id);
  return { mensagem: 'Orçamento atualizado.' };
}

/** O input de competência manda "2026-11"; o dominio so fala YYYY-MM-DD. */
const competenciaOpcional = z.preprocess(
  (v) => (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v === '' ? undefined : v),
  dataOpcional('Início da cobrança'),
);

const schemaItem = z.object({
  catalogoItemId: obrigatorio('Item do catálogo', 40),
  quantidade: decimalOpcional('Quantidade'),
  precoUnitario: decimalOpcional('Preço unitário'),
  escopo: enumDe('Escopo do item', ['PONTUAL', 'RECORRENTE'] as const),
  inicioVigencia: competenciaOpcional,
  periodicidade: enumDe('Periodicidade de reajuste', ['ANUAL', 'SEMESTRAL', 'NENHUM'] as const),
});

export async function adicionarItem(id: string, _prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('orcamentos');
  if (!('usuario' in acesso)) return acesso;
  const resultado = validar(schemaItem, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;

  const orcamento = await prisma.orcamento.findUnique({ where: { id }, select: { status: true } });
  if (!orcamento) return { erros: { _: 'Orçamento não encontrado.' } };
  if (!(EDITAVEL as readonly string[]).includes(orcamento.status)) {
    return { erros: { _: 'Só dá para mexer nos itens enquanto o orçamento está aberto ou enviado.' } };
  }

  const catalogo = await prisma.catalogoItem.findUnique({ where: { id: d.catalogoItemId } });
  if (!catalogo) return { erros: { catalogoItemId: 'Escolha um item do catálogo.' } };
  if (!catalogo.ativo) return { erros: { catalogoItemId: 'Este item está inativo no catálogo.' } };

  const quantidade = d.quantidade ? D(d.quantidade) : D(1);
  // Vazio usa a tabela do catálogo: o preço praticado costuma ser o público.
  const preco = money(d.precoUnitario ? D(d.precoUnitario) : D(catalogo.precoPublico));
  if (quantidade.lte(0)) return { erros: { quantidade: 'A quantidade precisa ser maior que zero.' } };

  await prisma.$transaction(async (tx) => {
    await tx.orcamentoItem.create({
      data: {
        orcamentoId: id,
        catalogoItemId: catalogo.id,
        // Snapshot: o catálogo pode mudar de nome/preço depois e o orçamento não.
        descricao: catalogo.nome,
        quantidade,
        precoUnitario: preco,
        total: money(quantidade.times(preco)),
        escopo: d.escopo,
        inicioVigencia: d.inicioVigencia ? toDate(competencia(d.inicioVigencia)) : null,
        periodicidade: d.escopo === 'RECORRENTE' ? d.periodicidade : 'NENHUM',
      },
    });
    const total = await totalDosItens(tx, id);
    await tx.orcamento.update({ where: { id }, data: { valorTotal: total } });
  });

  revalidar(id);
  return { mensagem: `${catalogo.nome} incluído no orçamento.` };
}

export async function removerItem(id: string, itemId: string): Promise<void> {
  const acesso = await autorizar('orcamentos');
  if (!('usuario' in acesso)) return;
  const item = await prisma.orcamentoItem.findFirst({ where: { id: itemId, orcamentoId: id } });
  if (!item) return;
  const orcamento = await prisma.orcamento.findUnique({ where: { id }, select: { status: true } });
  if (!orcamento || !(EDITAVEL as readonly string[]).includes(orcamento.status)) return;

  await prisma.$transaction(async (tx) => {
    await tx.orcamentoItem.delete({ where: { id: itemId } });
    await tx.orcamento.update({ where: { id }, data: { valorTotal: await totalDosItens(tx, id) } });
  });
  revalidar(id);
}

type AcaoStatus = 'enviar' | 'aprovar' | 'recusar' | 'expirar';

const TRANSICOES: Record<AcaoStatus, { de: string[]; para: 'ENVIADO' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO' }> = {
  enviar: { de: ['ABERTO'], para: 'ENVIADO' },
  aprovar: { de: ['ABERTO', 'ENVIADO'], para: 'APROVADO' },
  recusar: { de: ['ABERTO', 'ENVIADO'], para: 'RECUSADO' },
  expirar: { de: ['ABERTO', 'ENVIADO', 'APROVADO'], para: 'EXPIRADO' },
};

export async function mudarStatus(id: string, acao: AcaoStatus): Promise<void> {
  const acesso = await autorizar('orcamentos');
  if (!('usuario' in acesso)) return;
  const transicao = TRANSICOES[acao];
  const orcamento = await prisma.orcamento.findUnique({
    where: { id },
    select: { status: true, validade: true, aprovadoEm: true },
  });
  if (!orcamento || !transicao.de.includes(orcamento.status)) return;

  await prisma.orcamento.update({
    where: { id },
    data: {
      status: transicao.para,
      aprovadoEm: transicao.para === 'APROVADO' ? toDate(hoje()) : orcamento.aprovadoEm ?? null,
    },
  });
  await registrarAuditoria(acesso.usuario, {
    acao: `orcamento.${acao}`,
    entidade: 'orcamento',
    entidadeId: id,
    resumo: `${orcamento.status.toLowerCase()} → ${transicao.para.toLowerCase()}`,
  });
  revalidar(id);
}

const schemaConversao = z.object({
  escopo: enumDe('Escopo de cobrança', ['CONDOMINIO', 'UNIDADE'] as const),
  vencimentoDia: z
    .string({ required_error: 'Dia de vencimento é obrigatório.' })
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n >= 1 && n <= 31, 'Dia de vencimento entre 1 e 31.'),
  inicio: dataISO('Início da vigência'),
  fim: dataOpcional('Fim da vigência'),
});

/**
 * Conversao e a unica mutacao da F1 que cria negocio: contrato em rascunho (o
 * usuario ativa depois de conferir adesoes) e uma OS por item pontual.
 */
export async function converter(id: string, _prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const acesso = await autorizar('orcamentos');
  if (!('usuario' in acesso)) return acesso;
  const resultado = validar(schemaConversao, fd);
  if (!resultado.ok) return { erros: resultado.erros };
  const d = resultado.dados;
  if (d.fim && d.fim <= d.inicio) return { erros: { fim: 'O fim da vigência precisa ser depois do início.' } };

  const orcamento = await prisma.orcamento.findUnique({
    where: { id },
    include: { itens: { include: { catalogoItem: true }, orderBy: { id: 'asc' } } },
  });
  if (!orcamento) return { erros: { _: 'Orçamento não encontrado.' } };
  if (orcamento.status === 'CONVERTIDO' || orcamento.contratoId) {
    return { erros: { _: 'Este orçamento já foi convertido.' } };
  }
  if (orcamento.status !== 'APROVADO') {
    return { erros: { _: 'Aprove o orçamento antes de converter: a conversão cria contrato e OS.' } };
  }

  const recorrentes = orcamento.itens.filter((i) => i.escopo === 'RECORRENTE');
  const pontuais = orcamento.itens.filter((i) => i.escopo === 'PONTUAL');
  if (recorrentes.length === 0 && pontuais.length === 0) {
    return { erros: { _: 'O orçamento não tem itens para converter.' } };
  }

  const numeroContrato = await prisma.contrato.aggregate({ _max: { numero: true } });
  const numeroOs = await prisma.ordemServico.aggregate({ _max: { numero: true } });
  let osBase = numeroOs._max.numero ?? 0;
  let contratoCriado = false;

  const saida = await prisma.$transaction(async (tx) => {
    let contratoId: string | null = null;

    if (recorrentes.length > 0) {
      const contrato = await tx.contrato.create({
        data: {
          numero: (numeroContrato._max.numero ?? 0) + 1,
          clienteId: orcamento.clienteId,
          condominioId: orcamento.condominioId,
          escopo: d.escopo,
          inicio: toDate(d.inicio),
          fim: d.fim ? toDate(d.fim) : null,
          // Rascunho de propósito: ativação é decisão do financeiro depois de conferir adesões.
          status: 'RASCUNHO',
          vencimentoDia: d.vencimentoDia,
          observacoes: `Gerado do orçamento #${orcamento.numero} — ${orcamento.titulo}`,
        },
      });
      contratoId = contrato.id;
      contratoCriado = true;

      for (const item of recorrentes) {
        const preco = money(D(item.precoUnitario));
        const inicioItem = toISO(item.inicioVigencia) ?? d.inicio;
        const vigencia = competencia(inicioItem);
        const indice = item.catalogoItem.indiceReajusteId;
        const periodicidade = item.periodicidade ?? 'NENHUM';
        await tx.contratoItem.create({
          data: {
            contratoId: contrato.id,
            catalogoItemId: item.catalogoItemId,
            descricao: item.descricao,
            quantidade: D(item.quantidade),
            precoInicial: preco,
            precoAtual: preco,
            vigenciaDesde: toDate(vigencia),
            inicio: toDate(inicioItem),
            indiceReajusteId: periodicidade === 'NENHUM' ? null : indice,
            periodicidade,
            proximoReajusteEm:
              periodicidade === 'NENHUM' || !indice
                ? null
                : toDate(addMonths(vigencia, periodicidade === 'ANUAL' ? 12 : 6)),
          },
        });
      }
    }

    const ordens: number[] = [];
    for (const item of pontuais) {
      osBase += 1;
      const os = await tx.ordemServico.create({
        data: {
          numero: osBase,
          tipo: 'INSTALACAO',
          status: 'ABERTA',
          orcamentoId: orcamento.id,
          contratoId,
          condominioId: orcamento.condominioId,
          descricao: `${D(item.quantidade).toString()} × ${item.descricao} (orçamento #${orcamento.numero})`,
        },
      });
      ordens.push(os.numero);
    }

    await tx.orcamento.update({
      where: { id },
      data: { status: 'CONVERTIDO', convertidoEm: new Date(), contratoId },
    });

    return { contratoId, ordens };
  });

  revalidatePath('/orcamentos');
  revalidatePath('/contratos');
  revalidatePath(`/orcamentos/${id}`);
  await registrarAuditoria(acesso.usuario, {
    acao: 'orcamento.converter',
    entidade: 'orcamento',
    entidadeId: id,
    resumo: `${contratoCriado ? 'contrato criado em rascunho' : 'sem contrato (só itens pontuais)'} · ${
      saida.ordens.length
    } OS · ${brl(D(orcamento.valorTotal))}`,
  });
  const partes = [
    contratoCriado ? 'contrato criado em rascunho' : 'nenhum item recorrente (sem contrato)',
    `${saida.ordens.length} OS`,
  ];
  // O painel do formulário some quando o status muda: sem redirect a pessoa não veria o resultado.
  redirect(`/orcamentos/${id}?convertido=1&resumo=${encodeURIComponent(partes.join(' e '))}`);
}

import { readFile } from 'node:fs/promises';
import { Prisma, type EscopoCobranca, type StatusContrato } from '@prisma/client';
import { addMonths, toDate, vencimentoDaCompetencia, type Competencia, type DateISO } from '@/domain/dates';
import { D } from '@/domain/money';
import { prisma } from '../db';
import { numeroDoTitulo } from '../cobranca/gerar';
import { decodificar, lerCsv, normalizarChave, type Csv } from './csv';
import { inconsistenciaDoGrupo, lerLinhaCobranca, lerLinhaContrato, type LinhaContrato } from './planilha';

export type Rejeicao = { arquivo: string; linha: number; campo: string; motivo: string };

export type Opcoes = { contratos?: string; cobrancas?: string; dryRun?: boolean };

export type Resumo = {
  dryRun: boolean;
  clientes: { criados: number; reaproveitados: number };
  condominios: { criados: number };
  unidades: { criadas: number };
  contratos: { criados: number; atualizados: number };
  itens: { criados: number; atualizados: number };
  aderencias: { criadas: number; atualizadas: number };
  cobrancas: { criadas: number; pagas: number; isentas: number; jaExistiam: number };
  rejeicoes: Rejeicao[];
};

/** Jogado no fim da transação quando --dry-run: valida tudo e não grava nada. */
const DESFAZER = Symbol('desfazer');

type Grupo = { base: LinhaContrato; linhas: LinhaContrato[] };

async function lerArquivo(caminho: string): Promise<{ nome: string; csv: Csv }> {
  const conteudo = await readFile(caminho);
  const nome = caminho.split('/').pop() ?? caminho;
  return { nome, csv: lerCsv(decodificar(conteudo)) };
}

function novoResumo(dryRun: boolean): Resumo {
  return {
    dryRun,
    clientes: { criados: 0, reaproveitados: 0 },
    condominios: { criados: 0 },
    unidades: { criadas: 0 },
    contratos: { criados: 0, atualizados: 0 },
    itens: { criados: 0, atualizados: 0 },
    aderencias: { criadas: 0, atualizadas: 0 },
    cobrancas: { criadas: 0, pagas: 0, isentas: 0, jaExistiam: 0 },
    rejeicoes: [],
  };
}

type Tx = Prisma.TransactionClient;

/** Índices em memória das chaves naturais: é o que deixa a reimportação idempotente. */
async function indiceDaBase(tx: Tx) {
  const [clientes, condominios, unidades, catalogo, indices, contratos] = await Promise.all([
    tx.cliente.findMany({ select: { id: true, nome: true, documento: true } }),
    tx.condominio.findMany({ select: { id: true, nome: true, cidade: true, clienteId: true } }),
    tx.unidade.findMany({ select: { id: true, codigo: true, condominioId: true } }),
    tx.catalogoItem.findMany({ select: { id: true, nome: true } }),
    tx.indiceReajuste.findMany({ select: { id: true, sigla: true } }),
    tx.contrato.findMany({ select: { id: true, numero: true, condominioId: true, escopo: true, inicio: true } }),
  ]);

  const porNumero = new Map<string, string>();
  const porNome = new Map<string, string[]>();
  for (const c of clientes) {
    if (c.documento) porNumero.set(c.documento, c.id);
    const chave = normalizarChave(c.nome);
    porNome.set(chave, [...(porNome.get(chave) ?? []), c.id]);
  }

  const condominiosPorChave = new Map<string, { id: string; clienteId: string | null }>();
  for (const c of condominios) {
    condominiosPorChave.set(`${normalizarChave(c.nome)}|${normalizarChave(c.cidade ?? '')}`, { id: c.id, clienteId: c.clienteId });
  }

  const unidadesPorChave = new Map<string, string>();
  for (const u of unidades) unidadesPorChave.set(`${u.condominioId}|${normalizarChave(u.codigo)}`, u.id);

  const catalogoPorChave = new Map<string, string>();
  for (const i of catalogo) catalogoPorChave.set(normalizarChave(i.nome), i.id);

  const indicesPorChave = new Map<string, string>();
  for (const i of indices) indicesPorChave.set(normalizarChave(i.sigla), i.id);

  const contratosPorNumero = new Map<number, string>();
  const maePorCondominio = new Map<string, string>();
  for (const c of contratos.sort((a, b) => (a.inicio < b.inicio ? -1 : 1))) {
    contratosPorNumero.set(c.numero, c.id);
    if (c.escopo === 'CONDOMINIO' && c.condominioId) {
      if (!maePorCondominio.has(c.condominioId)) maePorCondominio.set(c.condominioId, c.id);
    }
  }

  return { porNumero, porNome, condominiosPorChave, unidadesPorChave, catalogoPorChave, indicesPorChave, contratosPorNumero, maePorCondominio };
}

function recusar(resumo: Resumo, arquivo: string, linha: number, campo: string, motivo: string): void {
  resumo.rejeicoes.push({ arquivo, linha, campo, motivo });
}

async function resolverCliente(
  tx: Tx,
  resumo: Resumo,
  indice: Awaited<ReturnType<typeof indiceDaBase>>,
  dados: LinhaContrato,
  arquivo: string,
  linha: number,
): Promise<string | null> {
  const peloDocumento = dados.clienteDocumento ? indice.porNumero.get(dados.clienteDocumento) : undefined;
  const candidatos = indice.porNome.get(normalizarChave(dados.clienteNome)) ?? [];

  if (peloDocumento) {
    indice.porNome.set(normalizarChave(dados.clienteNome), [peloDocumento]);
    resumo.clientes.reaproveitados += 1;
    return peloDocumento;
  }
  if (candidatos.length === 1) {
    const existente = await tx.cliente.findUnique({ where: { id: candidatos[0] as string }, select: { documento: true } });
    if (existente?.documento && dados.clienteDocumento && existente.documento !== dados.clienteDocumento) {
      recusar(resumo, arquivo, linha, 'cliente_documento', `Cliente "${dados.clienteNome}" já está cadastrado com outro documento (${existente.documento}).`);
      return null;
    }
    if (dados.clienteDocumento && !existente?.documento) {
      await tx.cliente.update({ where: { id: candidatos[0] as string }, data: { documento: dados.clienteDocumento } });
    }
    resumo.clientes.reaproveitados += 1;
    return candidatos[0] as string;
  }
  if (candidatos.length > 1) {
    recusar(resumo, arquivo, linha, 'cliente_documento', `Há ${candidatos.length} clientes chamados "${dados.clienteNome}": informe o CPF/CNPJ para a planilha não criar duplicidade.`);
    return null;
  }

  const criado = await tx.cliente.create({
    data: {
      nome: dados.clienteNome,
      documento: dados.clienteDocumento || null,
      tipo: dados.clienteTipo,
      cidade: dados.condominioCidade || null,
      ativo: dados.status !== 'DISTRATADO',
    },
  });
  indice.porNome.set(normalizarChave(criado.nome), [...(indice.porNome.get(normalizarChave(criado.nome)) ?? []), criado.id]);
  if (criado.documento) indice.porNumero.set(criado.documento, criado.id);
  resumo.clientes.criados += 1;
  return criado.id;
}

async function resolverCondominio(
  tx: Tx,
  resumo: Resumo,
  indice: Awaited<ReturnType<typeof indiceDaBase>>,
  dados: LinhaContrato,
  clienteId: string,
): Promise<string | null> {
  if (dados.condominioNome === '') return null;
  const chave = `${normalizarChave(dados.condominioNome)}|${normalizarChave(dados.condominioCidade)}`;
  const existente = indice.condominiosPorChave.get(chave);
  if (existente) {
    // O condomínio que assina e recebe o boleto único é o próprio cliente.
    if (!existente.clienteId && normalizarChave(dados.condominioNome) === normalizarChave(dados.clienteNome)) {
      await tx.condominio.update({ where: { id: existente.id }, data: { clienteId } });
      existente.clienteId = clienteId;
    }
    return existente.id;
  }
  const criado = await tx.condominio.create({
    data: {
      nome: dados.condominioNome,
      cidade: dados.condominioCidade || null,
      clienteId: normalizarChave(dados.condominioNome) === normalizarChave(dados.clienteNome) ? clienteId : null,
    },
  });
  indice.condominiosPorChave.set(chave, { id: criado.id, clienteId: criado.clienteId });
  resumo.condominios.criados += 1;
  return criado.id;
}

async function resolverUnidade(
  tx: Tx,
  resumo: Resumo,
  indice: Awaited<ReturnType<typeof indiceDaBase>>,
  dados: LinhaContrato,
  condominioId: string,
  clienteId: string,
): Promise<string | null> {
  if (dados.unidadeCodigo === '') return null;
  const chave = `${condominioId}|${normalizarChave(dados.unidadeCodigo)}`;
  const existente = indice.unidadesPorChave.get(chave);
  if (existente) return existente;
  const criada = await tx.unidade.create({
    data: { condominioId, codigo: dados.unidadeCodigo, titularId: clienteId, ativa: dados.fim === '' },
  });
  indice.unidadesPorChave.set(chave, criada.id);
  resumo.unidades.criadas += 1;
  return criada.id;
}

function proximoReajuste(inicio: DateISO, periodicidade: LinhaContrato['periodicidade']): DateISO | null {
  if (periodicidade === 'ANUAL') return addMonths(inicio, 12);
  if (periodicidade === 'SEMESTRAL') return addMonths(inicio, 6);
  return null;
}

async function importarContratos(
  tx: Tx,
  resumo: Resumo,
  indice: Awaited<ReturnType<typeof indiceDaBase>>,
  arquivo: string,
  csv: Csv,
): Promise<void> {
  const grupos = new Map<number, Grupo>();
  const ordem: number[] = [];

  for (const linha of csv.linhas) {
    const lido = lerLinhaContrato(linha);
    if (!lido.dados) {
      for (const e of lido.erros) recusar(resumo, arquivo, linha.numero, e.campo, e.motivo);
      continue;
    }
    const grupo = grupos.get(lido.dados.numero);
    if (!grupo) {
      grupos.set(lido.dados.numero, { base: lido.dados, linhas: [lido.dados] });
      ordem.push(lido.dados.numero);
      continue;
    }
    const conflito = inconsistenciaDoGrupo(grupo.base, lido.dados);
    if (conflito) {
      recusar(resumo, arquivo, linha.numero, 'numero', conflito);
      continue;
    }
    grupo.linhas.push(lido.dados);
  }

  for (const numero of ordem) {
    const grupo = grupos.get(numero) as Grupo;
    const primeira = grupo.base;
    const linhaNumero = csv.linhas.find((l) => Number(l.valores.numero) === numero)?.numero ?? 0;

    const clienteId = await resolverCliente(tx, resumo, indice, primeira, arquivo, linhaNumero);
    if (!clienteId) continue;
    const condominioId = await resolverCondominio(tx, resumo, indice, primeira, clienteId);

    let unidadeId: string | null = null;
    if (primeira.escopo === 'UNIDADE') {
      if (!condominioId) {
        recusar(resumo, arquivo, linhaNumero, 'condominio_nome', `Contrato ${numero} é por unidade, mas o condomínio não foi resolvido.`);
        continue;
      }
      unidadeId = await resolverUnidade(tx, resumo, indice, primeira, condominioId, clienteId);
      if (!unidadeId) {
        recusar(resumo, arquivo, linhaNumero, 'unidade_codigo', `Contrato ${numero} é por unidade, mas a unidade está vazia.`);
        continue;
      }
    }

    const dados = {
      numero,
      clienteId,
      condominioId,
      escopo: primeira.escopo as EscopoCobranca,
      inicio: toDate(primeira.inicio),
      fim: primeira.fim ? toDate(primeira.fim) : null,
      status: primeira.status as StatusContrato,
      vencimentoDia: primeira.vencimentoDia,
      observacoes: primeira.observacoes || null,
    };

    const existente = await tx.contrato.findUnique({ where: { numero }, select: { id: true } });
    const mae =
      primeira.escopo === 'UNIDADE' && condominioId ? indice.maePorCondominio.get(condominioId) ?? null : null;
    const dadosContrato = {
      ...dados,
      parentContractId: mae && mae !== existente?.id ? mae : null,
    };
    const contratoId = existente
      ? existente.id
      : (await tx.contrato.create({ data: dadosContrato })).id;
    if (existente) {
      await tx.contrato.update({ where: { id: existente.id }, data: dadosContrato });
      resumo.contratos.atualizados += 1;
    } else {
      resumo.contratos.criados += 1;
      if (condominioId && primeira.escopo === 'CONDOMINIO') {
        indice.maePorCondominio.set(condominioId, indice.maePorCondominio.get(condominioId) ?? contratoId);
      }
    }
    indice.contratosPorNumero.set(numero, contratoId);

    if (unidadeId) {
      const desde = toDate(primeira.inicio);
      const situacao = primeira.fim ? 'ENCERRADA' : 'ATIVA';
      const existente = await tx.contratoUnidade.findUnique({
        where: { contratoId_unidadeId_desde: { contratoId, unidadeId, desde } },
        select: { id: true },
      });
      await tx.contratoUnidade.upsert({
        where: { contratoId_unidadeId_desde: { contratoId, unidadeId, desde } },
        update: { moradorId: clienteId, situacao, ate: primeira.fim ? toDate(primeira.fim) : null },
        create: {
          contratoId,
          unidadeId,
          moradorId: clienteId,
          desde,
          ate: primeira.fim ? toDate(primeira.fim) : null,
          situacao,
        },
      });
      if (existente) resumo.aderencias.atualizadas += 1;
      else resumo.aderencias.criadas += 1;
    }

    for (const item of grupo.linhas) {
      const catalogoItemId = indice.catalogoPorChave.get(normalizarChave(item.itemNome));
      if (!catalogoItemId) {
        recusar(resumo, arquivo, linhaNumero, 'item_nome', `Item "${item.itemNome}" não está no catálogo. Cadastre-o em Cadastros > Catálogo ou corrija o nome na planilha.`);
        continue;
      }
      let indiceReajusteId: string | null = null;
      if (item.indiceSigla) {
        const encontrado = indice.indicesPorChave.get(normalizarChave(item.indiceSigla));
        if (!encontrado) {
          recusar(resumo, arquivo, linhaNumero, 'indice_sigla', `Índice "${item.indiceSigla}" não cadastrado.`);
          continue;
        }
        indiceReajusteId = encontrado;
      }

      const preco = D(item.preco);
      const ja = await tx.contratoItem.findFirst({
        where: { contratoId, catalogoItemId },
        select: { id: true, inicio: true },
      });
      const payload = {
        descricao: item.itemNome,
        quantidade: D(item.quantidade),
        precoAtual: preco,
        vigenciaDesde: toDate(item.inicio),
        fim: item.fim ? toDate(item.fim) : null,
        indiceReajusteId,
        periodicidade: item.periodicidade,
        proximoReajusteEm: proximoReajuste(item.inicio, item.periodicidade) ? toDate(proximoReajuste(item.inicio, item.periodicidade) as DateISO) : null,
        ativo: item.fim === '' && primeira.status !== 'DISTRATADO',
      };
      if (ja) {
        await tx.contratoItem.update({ where: { id: ja.id }, data: payload });
        resumo.itens.atualizados += 1;
      } else {
        await tx.contratoItem.create({ data: { ...payload, contratoId, catalogoItemId, precoInicial: preco, inicio: toDate(item.inicio) } });
        resumo.itens.criados += 1;
      }
    }
  }
}

async function importarCobrancas(
  tx: Tx,
  resumo: Resumo,
  indice: Awaited<ReturnType<typeof indiceDaBase>>,
  arquivo: string,
  csv: Csv,
): Promise<void> {
  const devedorCache = new Map<string, string>();

  for (const linha of csv.linhas) {
    const lido = lerLinhaCobranca(linha);
    if (!lido.dados) {
      for (const e of lido.erros) recusar(resumo, arquivo, linha.numero, e.campo, e.motivo);
      continue;
    }
    const dados = lido.dados;
    const contratoId = indice.contratosPorNumero.get(dados.numero);
    if (!contratoId) {
      recusar(resumo, arquivo, linha.numero, 'numero', `Contrato ${dados.numero} não existe: a cobrança precisa vir na aba de contratos.`);
      continue;
    }

    const contrato = await tx.contrato.findUnique({
      where: { id: contratoId },
      include: { cliente: { select: { nome: true } }, condominio: { select: { nome: true } }, aderencias: { include: { unidade: true }, orderBy: { desde: 'desc' }, take: 1 } },
    });
    if (!contrato) continue;

    const faturaExistente = await tx.fatura.findUnique({
      where: { contratoId_competencia: { contratoId, competencia: toDate(dados.competencia) } },
    });
    const numero = numeroDoTitulo(dados.numero, dados.competencia as Competencia);
    const tituloExistente = await tx.titulo.findUnique({ where: { numero }, select: { id: true } });
    if (faturaExistente || tituloExistente) {
      resumo.cobrancas.jaExistiam += 1;
      continue;
    }

    let devedorNome = dados.devedorNome;
    if (devedorNome === '') {
      const emCache = devedorCache.get(contratoId);
      if (emCache) {
        devedorNome = emCache;
      } else {
        devedorNome =
          contrato.escopo === 'UNIDADE' && contrato.aderencias[0]?.unidade
            ? contrato.aderencias[0].unidade.codigo
            : contrato.cliente.nome;
        devedorCache.set(contratoId, devedorNome);
      }
    }

    const valor = D(dados.valor);
    const vencimento = dados.vencimento || vencimentoDaCompetencia(dados.competencia, contrato.vencimentoDia);

    await tx.fatura.create({
      data: {
        contratoId,
        competencia: toDate(dados.competencia),
        valorBruto: valor,
        desconto: D(0),
        acrescimos: D(0),
        valorLiquido: valor,
        motivo: 'importacao-planilha',
        titulos: {
          create: {
            contratoId,
            competencia: toDate(dados.competencia),
            numero,
            devedorNome,
            condominioNome: contrato.condominio?.nome ?? null,
            escopo: contrato.escopo,
            valorOriginal: valor,
            vencimento: toDate(vencimento),
            boletoGerado: dados.boletoEmitido,
            nfEmitida: dados.nfEmitida,
            nfNumero: dados.nfNumero || null,
            nossoNumero: dados.nossoNumero || null,
            isento: dados.isento,
            isentoMotivo: dados.isento ? dados.observacoes || 'Convênio (importação da planilha).' : null,
            pago: dados.pago,
            pagoEm: dados.pago ? toDate(dados.pagoEm) : null,
            forma: dados.pago ? dados.forma : null,
            pagamentos: dados.pago
              ? {
                  create: {
                    valor,
                    data: toDate(dados.pagoEm),
                    forma: dados.forma,
                    observacao: 'Histórico trazido da planilha.',
                  },
                }
              : undefined,
          },
        },
      },
    });

    resumo.cobrancas.criadas += 1;
    if (dados.pago) resumo.cobrancas.pagas += 1;
    if (dados.isento) resumo.cobrancas.isentas += 1;
  }
}

/**
 * Importa a planilha atual (clientes, condomínios, contratos, histórico de
 * cobrança). Rodar de novo com o mesmo arquivo não duplica nada: as chaves
 * naturais (documento, nome+cidade, número do contrato, contrato+competência)
 * resolvem o registro existente, e o relatório de rejeições diz linha a linha
 * o que a planilha não respondeu.
 */
export async function importarPlanilha(opcoes: Opcoes): Promise<Resumo> {
  const resumo = novoResumo(!!opcoes.dryRun);
  if (!opcoes.contratos && !opcoes.cobrancas) {
    throw new Error('informe --contratos=<csv> e/ou --cobrancas=<csv>');
  }

  const contratos = opcoes.contratos ? await lerArquivo(opcoes.contratos) : null;
  const cobrancas = opcoes.cobrancas ? await lerArquivo(opcoes.cobrancas) : null;
  for (const [nome, csv] of [
    [contratos?.nome, contratos?.csv],
    [cobrancas?.nome, cobrancas?.csv],
  ] as const) {
    if (!nome || !csv) continue;
    for (const e of csv.erros) recusar(resumo, nome, 0, e.campo, e.motivo);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const indice = await indiceDaBase(tx);
      if (contratos) await importarContratos(tx, resumo, indice, contratos.nome, contratos.csv);
      if (cobrancas) await importarCobrancas(tx, resumo, indice, cobrancas.nome, cobrancas.csv);
      if (opcoes.dryRun) throw DESFAZER;
    });
  } catch (erro) {
    if (erro !== DESFAZER) throw erro;
  }

  return resumo;
}

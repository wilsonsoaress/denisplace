import Link from 'next/link';
import { exigirPagina, podeEditar } from '@/auth/guard';
import { notFound } from 'next/navigation';
import type { ContratoItem } from '@prisma/client';
import { prisma } from '@/server/db';
import {
  adicionarItem,
  aderirUnidade,
  aplicarReajuste,
  distratar,
  encerrarAderencia,
  encerrarItem,
  gerarCobrancaDoContrato,
  mudarStatus,
  salvarContrato,
} from '@/server/acoes/contratos';
import { D, brl, brlPct, money } from '@/domain/money';
import { competencia, hoje, toDate, toISO, type Competencia } from '@/domain/dates';
import { acumuladoPercentual, janelaDeReajuste, novoPreco } from '@/domain/reajuste';
import { Cabecalho, param } from '@/ui/pagina';
import { ESCOPO_COBRANCA, PERIODICIDADE_REAJUSTE, STATUS_CONTRATO, TIPO_ADITIVO } from '@/lib/rotulos';
import { chipStatus, listasParaAderencia, listasParaContrato, mensalDe } from '../dados';
import { FormContrato } from '../form';
import {
  FormAderencia,
  FormDistrato,
  FormEncerrarAderencia,
  FormEncerrarItem,
  FormGerarCobranca,
  FormItemContrato,
  FormReajuste,
} from './formularios';

export const metadata = { title: 'Contrato' };

function linhaMensal(item: Pick<ContratoItem, 'quantidade' | 'precoAtual'>) {
  return money(D(item.quantidade).times(D(item.precoAtual)));
}

function BotaoStatus({
  id,
  acao,
  rotulo,
  primario,
  inutil,
}: {
  id: string;
  acao: 'ativar' | 'suspender' | 'retomar';
  rotulo: string;
  primario?: boolean;
  inutil?: boolean;
}) {
  return (
    <form action={mudarStatus.bind(null, id, acao)}>
      <button type="submit" className={`btn ${primario ? 'btn-primary' : ''}`} disabled={inutil}>
        {rotulo}
      </button>
    </form>
  );
}

export default async function ContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/contratos/[id]');
  const editar = await podeEditar('contratos');
  const { id } = await params;
  const busca = await searchParams;
  const criado = busca.criado !== undefined;
  const salvo = busca.salvo !== undefined;
  const idReajuste = await param(searchParams, 'reajustar');
  const idEncerrarItem = await param(searchParams, 'encerrar_item');
  const idAderencia = await param(searchParams, 'encerrar_adesao');

  const contrato = await prisma.contrato.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true } },
      condominio: { select: { id: true, nome: true, cidade: true } },
      parent: { select: { id: true, numero: true } },
      itens: {
        include: { indiceReajuste: { select: { id: true, sigla: true } } },
        orderBy: [{ ativo: 'desc' }, { inicio: 'asc' }],
      },
      aderencias: {
        include: {
          unidade: { select: { id: true, codigo: true } },
          morador: { select: { id: true, nome: true } },
        },
        orderBy: { desde: 'desc' },
      },
      aditivos: { orderBy: { numero: 'desc' }, take: 15 },
      titulos: { orderBy: { competencia: 'desc' }, take: 12 },
    },
  });
  if (!contrato) notFound();

  const itemReajuste = idReajuste ? contrato.itens.find((i) => i.id === idReajuste) : null;
  const itemEncerrar = idEncerrarItem ? contrato.itens.find((i) => i.id === idEncerrarItem) : null;
  const adesaoEncerrar = idAderencia ? contrato.aderencias.find((a) => a.id === idAderencia) : null;
  if ((idReajuste && !itemReajuste) || (idEncerrarItem && !itemEncerrar) || (idAderencia && !adesaoEncerrar)) {
    notFound();
  }

  const listas = await listasParaContrato();
  // O registro precisa continuar selecionável mesmo se virou inativo depois da criação.
  listas.clientes = [
    ...listas.clientes,
    ...(listas.clientes.some((o) => o.value === contrato.clienteId)
      ? []
      : [{ value: contrato.clienteId, label: `${contrato.cliente.nome} (inativo)` }]),
  ];
  listas.condominios = [
    ...listas.condominios,
    ...(contrato.condominioId && !listas.condominios.some((o) => o.value === contrato.condominioId)
      ? [{ value: contrato.condominioId, label: contrato.condominio?.nome ?? 'condomínio' }]
      : []),
  ];

  const ativas = contrato.itens.filter((i) => i.ativo);
  const bruto = mensalDe(ativas);
  const desconto = money(bruto.times(D(contrato.descontoPct)).div(100));
  const liquido = money(bruto.minus(desconto));

  const emAberto = await prisma.titulo.aggregate({
    where: { contratoId: id, pago: false, isento: false },
    _count: true,
    _sum: { valorOriginal: true },
  });

  const adesoes = contrato.escopo === 'UNIDADE' ? await listasParaAderencia(contrato.condominioId) : null;

  // Preview do reajuste: mesma janela de meses que a ação vai usar, para o número
  // exibido na tela ser exatamente o que entra no aditivo.
  let preview = '';
  let compPadrao = competencia(hoje()) as Competencia;
  if (itemReajuste?.indiceReajuste && itemReajuste.periodicidade !== 'NENHUM') {
    compPadrao = (toISO(itemReajuste.proximoReajusteEm) ?? competencia(hoje())) as Competencia;
    const { desde, ate, meses } = janelaDeReajuste(
      competencia(compPadrao) as Competencia,
      itemReajuste.periodicidade === 'SEMESTRAL' ? 'SEMESTRAL' : 'ANUAL',
    );
    const valores = await prisma.indiceValor.findMany({
      where: { indiceId: itemReajuste.indiceReajusteId as string, competencia: { gte: toDate(desde), lte: toDate(ate) } },
      orderBy: { competencia: 'asc' },
    });
    const acumulado = acumuladoPercentual(
      valores.map((v) => ({ competencia: toISO(v.competencia) ?? '', variacaoMensal: v.variacaoMensal })),
      desde,
      ate,
    );
    preview =
      acumulado === null
        ? `Série do ${itemReajuste.indiceReajuste.sigla} incompleta entre ${desde.slice(0, 7)} e ${ate.slice(0, 7)} (${
            valores.length
          }/${meses} meses). O reajuste é barrado em vez de estimado.`
        : `${itemReajuste.indiceReajuste.sigla} acumulado ${meses} meses (${desde.slice(0, 7)} a ${ate.slice(
            0,
            7,
          )}) = ${brlPct(acumulado)} · ${brl(itemReajuste.precoAtual)} → ${brl(
            novoPreco(money(D(itemReajuste.precoAtual)), acumulado),
          )}`;
  }

  const compCobranca = competencia(hoje());

  return (
    <>
      <Cabecalho
        titulo={`Contrato #${contrato.numero} · ${contrato.cliente.nome}`}
        descricao={`${contrato.condominio?.nome ?? 'sem condomínio'} · ${ESCOPO_COBRANCA[contrato.escopo]} · ${
          contrato.vencimentoDia
        }º dia · vigência ${toISO(contrato.inicio)} a ${contrato.fim ? toISO(contrato.fim) : 'indefinida'}`}
        voltar={{ href: '/contratos', label: 'Voltar para contratos' }}
        acoes={
          <>
            {!editar ? <span className="chip chip-free">somente leitura</span> : null}
            {contrato.status === 'DISTRATADO' ? (
              <span className={chipStatus(contrato.status)}>Distratado</span>
            ) : (
              <>
                {editar ? (
                  <>
                    {contrato.status === 'RASCUNHO' || contrato.status === 'VENCIDO' ? (
                      <BotaoStatus
                        id={contrato.id}
                        acao="ativar"
                        rotulo="Ativar contrato"
                        primario
                        inutil={ativas.length === 0}
                      />
                    ) : null}
                    {contrato.status === 'SUSPENSO' ? <BotaoStatus id={contrato.id} acao="retomar" rotulo="Retomar" /> : null}
                    {contrato.status === 'VIGENTE' ? <BotaoStatus id={contrato.id} acao="suspender" rotulo="Suspender" /> : null}
                  </>
                ) : null}
              </>
            )}
          </>
        }
      />

      {!editar ? (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
          Seu perfil só lê contratos: as ações desta tela não gravam nada. Quem altera vigência, itens e cobrança é o
          financeiro.
        </p>
      ) : null}

      {criado ? (
        <p className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">
          Contrato #{contrato.numero} criado como rascunho. Adicione os itens abaixo e ative o contrato para que ele
          entre na cobrança do mês.
        </p>
      ) : null}
      {salvo && !criado ? (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Contrato atualizado.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dados básicos</h2>
            {contrato.parent ? (
              <p className="mb-3 text-xs text-slate-600">
                Contrato filho de{' '}
                <Link href={`/contratos/${contrato.parent.id}`} className="text-blue-800 hover:underline">
                  #{contrato.parent.numero}
                </Link>
                .
              </p>
            ) : null}
            {editar ? <FormContrato acao={salvarContrato.bind(null, contrato.id)} registro={contrato} listas={listas} /> : null}
          </section>

          <section className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Itens do contrato ({ativas.length} ativo(s))
              </h2>
              <span className="num text-sm">Mensal bruto: <b>{brl(bruto)}</b></span>
            </div>

            {contrato.status === 'RASCUNHO' && ativas.length === 0 ? (
              <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Sem item ativo não há o que cobrar: o contrato não pode ser ativado e a geração mensal o ignora.
              </p>
            ) : null}

            {contrato.itens.length === 0 ? (
              <p className="mb-3 text-sm text-slate-500">Nenhum item cadastrado.</p>
            ) : (
              <div className="mb-4 overflow-x-auto">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Qtd</th>
                      <th className="num">Preço vigente</th>
                      <th className="num">Mensal</th>
                      <th>Reajuste</th>
                      <th>Próximo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contrato.itens.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <span className="font-medium">{i.descricao}</span>
                          {!i.ativo ? <span className="chip chip-free ml-2">encerrado</span> : null}
                          <div className="num text-xs text-slate-500">
                            vigente desde {toISO(i.vigenciaDesde)}
                            {i.fim ? ` · cobrado até ${toISO(i.fim)}` : ''}
                          </div>
                        </td>
                        <td className="num">{i.quantidade.toString()}</td>
                        <td className="num">{brl(i.precoAtual)}</td>
                        <td className="num">{brl(linhaMensal(i))}</td>
                        <td className="text-xs">
                          {i.indiceReajuste
                            ? `${i.indiceReajuste.sigla} · ${PERIODICIDADE_REAJUSTE[i.periodicidade]}`
                            : 'sem índice'}
                        </td>
                        <td className="num text-xs">{i.proximoReajusteEm ? toISO(i.proximoReajusteEm) : '—'}</td>
                        <td className="whitespace-nowrap text-xs">
                          {i.ativo && editar ? (
                            <span className="space-x-2">
                              {i.indiceReajuste && i.periodicidade !== 'NENHUM' ? (
                                <Link
                                  href={`/contratos/${contrato.id}?reajustar=${i.id}`}
                                  className="text-blue-800 hover:underline"
                                >
                                  reajustar
                                </Link>
                              ) : null}
                              <Link
                                href={`/contratos/${contrato.id}?encerrar_item=${i.id}`}
                                className="text-slate-500 hover:text-red-700"
                              >
                                encerrar
                              </Link>
                            </span>
                          ) : i.ativo ? null : (
                            <span className="text-xs text-slate-400">histórico</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {itemReajuste ? (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reajuste de {itemReajuste.descricao}
                  </h3>
                  <Link href={`/contratos/${contrato.id}`} className="text-xs text-slate-500 hover:text-red-700">
                    cancelar
                  </Link>
                </div>
                <FormReajuste
                  acao={aplicarReajuste.bind(null, contrato.id, itemReajuste.id)}
                  descricao={itemReajuste.descricao}
                  compPadrao={compPadrao}
                  preview={preview}
                />
              </div>
            ) : null}

            {itemEncerrar ? (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Encerrar {itemEncerrar.descricao}
                  </h3>
                  <Link href={`/contratos/${contrato.id}`} className="text-xs text-slate-500 hover:text-red-700">
                    cancelar
                  </Link>
                </div>
                <FormEncerrarItem
                  acao={encerrarItem.bind(null, contrato.id, itemEncerrar.id)}
                  descricao={itemEncerrar.descricao}
                  dataPadrao={hoje()}
                />
              </div>
            ) : null}

            {contrato.status !== 'DISTRATADO' && editar ? (
              <>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Adicionar item do catálogo
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Quantidade e preço não são editáveis depois: para mudar, encerre o item e adicione outro — assim o
                  histórico de cobrança continua batendo com o aditivo.
                </p>
                <FormItemContrato
                  acao={adicionarItem.bind(null, contrato.id)}
                  catalogo={listas.catalogo}
                  indices={listas.indices}
                  inicioPadrao={hoje()}
                />
              </>
            ) : null}
          </section>

          {contrato.escopo === 'UNIDADE' ? (
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Adesões por unidade ({contrato.aderencias.filter((a) => a.situacao === 'ATIVA').length} ativa(s))
              </h2>
              {contrato.aderencias.length === 0 ? (
                <p className="mb-3 text-sm text-slate-500">
                  Nenhuma unidade aderida: este contrato ainda não gera boleto de morador.
                </p>
              ) : (
                <div className="mb-4 max-h-96 overflow-auto">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Unidade</th>
                        <th>Morador</th>
                        <th>Desde</th>
                        <th>Até</th>
                        <th>Situação</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contrato.aderencias.map((a) => (
                        <tr key={a.id}>
                          <td className="font-medium">{a.unidade.codigo}</td>
                          <td>
                            {a.morador ? (
                              <Link href={`/cadastros/clientes/${a.morador.id}`} className="text-blue-800 hover:underline">
                                {a.morador.nome}
                              </Link>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="num text-xs">{toISO(a.desde)}</td>
                          <td className="num text-xs">{a.ate ? toISO(a.ate) : '—'}</td>
                          <td>
                            <span className={`chip ${a.situacao === 'ATIVA' ? 'chip-ok' : 'chip-free'}`}>
                              {a.situacao === 'ATIVA' ? 'ativa' : 'encerrada'}
                            </span>
                          </td>
                          <td className="text-xs">
                            {a.situacao === 'ATIVA' && editar ? (
                              <Link
                                href={`/contratos/${contrato.id}?encerrar_adesao=${a.id}`}
                                className="text-slate-500 hover:text-red-700"
                              >
                                encerrar
                              </Link>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {adesaoEncerrar && adesoes ? (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Encerrar adesão de {adesaoEncerrar.unidade.codigo}
                    </h3>
                    <Link href={`/contratos/${contrato.id}`} className="text-xs text-slate-500 hover:text-red-700">
                      cancelar
                    </Link>
                  </div>
                  <FormEncerrarAderencia
                    acao={encerrarAderencia.bind(null, contrato.id, adesaoEncerrar.id)}
                    codigo={adesaoEncerrar.unidade.codigo}
                    atePadrao={hoje()}
                  />
                </div>
              ) : null}

              {adesoes && adesoes.unidades.length > 0 && editar ? (
                <FormAderencia
                  acao={aderirUnidade.bind(null, contrato.id)}
                  unidades={adesoes.unidades}
                  moradores={adesoes.moradores}
                  desdePadrao={hoje()}
                />
              ) : editar ? (
                <p className="text-xs text-slate-500">
                  Cadastre as unidades em{' '}
                  <Link href="/cadastros/condominios" className="text-blue-800 hover:underline">
                    Condomínios
                  </Link>{' '}
                  antes de aderir.
                </p>
              ) : null}
            </section>
          ) : null}

          {contrato.status === 'DISTRATADO' ? (
            <section className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Distrato</h2>
              <p className="text-sm">
                Encerrado em {contrato.distratoEm ? toISO(contrato.distratoEm) : '—'} · motivo:{' '}
                {contrato.distratoMotivo ?? 'não informado'}
              </p>
            </section>
          ) : editar ? (
            <details className="card">
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-500">
                Distratar contrato
              </summary>
              <p className="mb-3 mt-2 text-xs text-slate-500">
                Encerra a vigência, desativa os itens e registra o aditivo com o motivo. Faturas já emitidas continuam
                existindo.
              </p>
              <FormDistrato acao={distratar.bind(null, contrato.id)} dataPadrao={hoje()} />
            </details>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Previsão de fatura</h2>
            <ul className="num space-y-1 text-sm">
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Bruto</span>
                <span>{brl(bruto)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">
                  Desconto ({brlPct(D(contrato.descontoPct))})
                </span>
                <span>- {brl(desconto)}</span>
              </li>
              <li className="flex justify-between gap-2 border-t border-slate-200 pt-1 font-semibold">
                <span>Líquido por mês</span>
                <span>{brl(liquido)}</span>
              </li>
              <li className="flex justify-between gap-2 pt-2 text-xs">
                <span className="text-slate-600">Títulos em aberto</span>
                <span>
                  {emAberto._count} · {brl(emAberto._sum.valorOriginal)}
                </span>
              </li>
              <li className="flex justify-between gap-2 text-xs">
                <span className="text-slate-600">Status</span>
                <span className={chipStatus(contrato.status)}>{STATUS_CONTRATO[contrato.status]}</span>
              </li>
            </ul>
          </section>

          {contrato.status !== 'RASCUNHO' ? (
            <section className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Cobrança</h2>
              <p className="mb-3 text-xs text-slate-500">
                O job mensal roda para todos os contratos vigentes. Gere aqui quando precisar refazer uma competência
                específica — reprocessar não duplica.
              </p>
              {editar ? (
                <FormGerarCobranca acao={gerarCobrancaDoContrato.bind(null, contrato.id)} compPadrao={compCobranca} />
              ) : null}
              {contrato.titulos.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Nenhum título gerado ainda.</p>
              ) : (
                <div className="mt-3 max-h-80 overflow-auto">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Comp.</th>
                        <th className="num">Valor</th>
                        <th>Venc.</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contrato.titulos.map((t) => (
                        <tr key={t.id}>
                          <td className="num">{toISO(t.competencia)?.slice(0, 7)}</td>
                          <td className="num">{brl(t.valorOriginal)}</td>
                          <td className="num">{toISO(t.vencimento)}</td>
                          <td>
                            {t.isento ? (
                              <span className="chip chip-free">isento</span>
                            ) : t.pago ? (
                              <span className="chip chip-ok">pago {toISO(t.pagoEm)}</span>
                            ) : (
                              <span className={`chip ${toISO(t.vencimento)! < hoje() ? 'chip-bad' : 'chip-warn'}`}>
                                {t.boletoGerado ? 'boleto emitido' : 'a emitir'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Aditivos ({contrato.aditivos.length})
            </h2>
            {contrato.aditivos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum aditivo ainda.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {contrato.aditivos.map((a) => (
                  <li key={a.id} className="border-l-2 border-slate-200 pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-xs text-slate-500">#{a.numero}</span>
                      <span className="chip chip-free">{TIPO_ADITIVO[a.tipo]}</span>
                      <span className="num text-xs text-slate-500">{toISO(a.competencia)?.slice(0, 7)}</span>
                    </div>
                    <p className="mt-1">{a.descricao}</p>
                    {a.valorAnterior || a.valorNovo ? (
                      <p className="num text-xs text-slate-600">
                        {a.valorAnterior ? brl(a.valorAnterior) : '—'} → {a.valorNovo ? brl(a.valorNovo) : '—'}
                      </p>
                    ) : null}
                    {a.detalhe ? <p className="text-xs text-slate-500">{a.detalhe}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

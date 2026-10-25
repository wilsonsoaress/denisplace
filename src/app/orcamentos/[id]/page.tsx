import Link from 'next/link';
import { exigirPagina, podeEditar } from '@/auth/guard';
import { notFound } from 'next/navigation';
import type { OrcamentoItem } from '@prisma/client';
import { prisma } from '@/server/db';
import { adicionarItem, converter, mudarStatus, removerItem, salvarOrcamento } from '@/server/acoes/orcamentos';
import { D, brl, money } from '@/domain/money';
import { hoje, toISO } from '@/domain/dates';
import { ESCOPO_ITEM, PERIODICIDADE_REAJUSTE, STATUS_ORCAMENTO, STATUS_OS } from '@/lib/rotulos';
import { Cabecalho, param } from '@/ui/pagina';
import { listasParaContrato } from '@/app/contratos/dados';
import { CHIP_ORCAMENTO } from '../dados';
import { FormConversao, FormItemOrcamento, FormOrcamento } from '../formularios';

export const metadata = { title: 'Orçamento' };

const EDITAVEL = ['ABERTO', 'ENVIADO'];

function BotaoStatus({ id, acao, rotulo, primario }: { id: string; acao: 'enviar' | 'aprovar' | 'recusar' | 'expirar'; rotulo: string; primario?: boolean }) {
  return (
    <form action={mudarStatus.bind(null, id, acao)}>
      <button type="submit" className={`btn ${primario ? 'btn-primary' : ''}`}>
        {rotulo}
      </button>
    </form>
  );
}

function totalItem(item: OrcamentoItem) {
  return money(D(item.quantidade).times(D(item.precoUnitario)));
}

export default async function OrcamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/orcamentos/[id]');
  const { id } = await params;
  const busca = await searchParams;
  const criado = busca.criado !== undefined;
  const convertido = busca.convertido !== undefined;

  const orcamento = await prisma.orcamento.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true } },
      condominio: { select: { id: true, nome: true, cidade: true } },
      itens: { include: { catalogoItem: { select: { id: true, tipo: true, indiceReajuste: { select: { sigla: true } } } } }, orderBy: { id: 'asc' } },
      contrato: { select: { id: true, numero: true, status: true } },
      ordensServico: { orderBy: { numero: 'asc' } },
    },
  });
  if (!orcamento) notFound();

  const listas = await listasParaContrato();
  const podeGravar = await podeEditar('orcamentos');
  const editavel = podeGravar && EDITAVEL.includes(orcamento.status);
  const recorrentes = orcamento.itens.filter((i) => i.escopo === 'RECORRENTE');
  const pontuais = orcamento.itens.filter((i) => i.escopo === 'PONTUAL');
  const validadePassada = (toISO(orcamento.validade) ?? '') < hoje();

  return (
    <>
      <Cabecalho
        titulo={`Orçamento #${orcamento.numero}`}
        descricao={`${orcamento.cliente.nome}${orcamento.condominio ? ` · ${orcamento.condominio.nome}` : ''} · validade ${toISO(orcamento.validade)}`}
        voltar={{ href: '/orcamentos', label: 'Voltar para orçamentos' }}
        acoes={
          <>
            <span className={CHIP_ORCAMENTO[orcamento.status]}>{STATUS_ORCAMENTO[orcamento.status]}</span>
            {editavel && orcamento.status === 'ABERTO' ? (
              <BotaoStatus id={id} acao="enviar" rotulo="Marcar como enviado" />
            ) : null}
            {editavel ? (
              <BotaoStatus id={id} acao="aprovar" rotulo="Aprovar" primario />
            ) : null}
            {editavel ? <BotaoStatus id={id} acao="recusar" rotulo="Recusar" /> : null}
            {editavel && validadePassada ? <BotaoStatus id={id} acao="expirar" rotulo="Dar como expirado" /> : null}
          </>
        }
      />

      {criado ? (
        <p className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Orçamento criado. Agora inclua os itens marcando cada um como pontual ou recorrente.
        </p>
      ) : null}
      {convertido ? (
        <p className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Orçamento convertido — {busca.resumo ?? 'veja a saída no painel ao lado'}
        </p>
      ) : null}
      {validadePassada && editavel ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          A validade passou de {toISO(orcamento.validade)}. Aprove para converter mesmo assim, ou dê como expirado para
          tirar do funil.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Itens do orçamento</h2>
            {orcamento.itens.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum item ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Escopo</th>
                      <th className="text-right">Qtd</th>
                      <th className="text-right">Preço un.</th>
                      <th className="text-right">Total</th>
                      <th>Condições</th>
                      {editavel ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {orcamento.itens.map((i) => (
                      <tr key={i.id}>
                        <td>{i.descricao}</td>
                        <td>
                          <span className={i.escopo === 'RECORRENTE' ? 'chip chip-ok' : 'chip chip-warn'}>
                            {ESCOPO_ITEM[i.escopo].toLowerCase()}
                          </span>
                        </td>
                        <td className="num text-right">{i.quantidade.toString()}</td>
                        <td className="num text-right">{brl(i.precoUnitario)}</td>
                        <td className="num text-right">{brl(totalItem(i))}</td>
                        <td className="text-xs text-slate-600">
                          {i.escopo === 'RECORRENTE'
                            ? `${i.inicioVigencia ? `desde ${toISO(i.inicioVigencia)} · ` : 'desde o início do contrato · '}${
                                i.periodicidade ? PERIODICIDADE_REAJUSTE[i.periodicidade].toLowerCase() : 'sem reajuste'
                              }${i.catalogoItem.indiceReajuste ? ` (${i.catalogoItem.indiceReajuste.sigla})` : ''}`
                            : 'execução pontual'}
                        </td>
                        {editavel ? (
                          <td className="text-right">
                            <form action={removerItem.bind(null, id, i.id)}>
                              <button type="submit" className="text-xs text-slate-500 hover:text-red-700">
                                remover
                              </button>
                            </form>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right text-xs uppercase tracking-wide text-slate-500">
                        total previsto
                      </td>
                      <td className="num text-right font-semibold">{brl(orcamento.valorTotal)}</td>
                      <td colSpan={editavel ? 2 : 1} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              {recorrentes.length} recorrente(s) → contrato · {pontuais.length} pontual(is) → ordem de serviço
            </p>
          </section>

          {editavel ? (
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Incluir item</h2>
              <FormItemOrcamento acao={adicionarItem.bind(null, id)} listas={listas} />
            </section>
          ) : null}

          {orcamento.status === 'APROVADO' && podeGravar ? (
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Converter</h2>
              <FormConversao acao={converter.bind(null, id)} inicioPadrao={hoje()} />
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          {editavel ? (
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dados do orçamento</h2>
              <FormOrcamento acao={salvarOrcamento.bind(null, id)} registro={orcamento} listas={listas} />
            </section>
          ) : null}

          <section className="card text-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Saída da conversão</h2>
            {orcamento.contrato ? (
              <p>
                <Link href={`/contratos/${orcamento.contrato.id}`} className="text-blue-800 hover:underline">
                  Contrato #{orcamento.contrato.numero}
                </Link>{' '}
                · {orcamento.contrato.status.toLowerCase()}
              </p>
            ) : (
              <p className="text-slate-500">
                {orcamento.status === 'CONVERTIDO'
                  ? 'Sem contrato: o orçamento só tinha itens pontuais.'
                  : 'Nada convertido ainda.'}
              </p>
            )}
            {orcamento.ordensServico.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {orcamento.ordensServico.map((os) => (
                  <li key={os.id} className="text-xs">
                    <b className="num">OS #{os.numero}</b> · {os.descricao} ·{' '}
                    <span className="chip chip-warn">{STATUS_OS[os.status].toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <dl className="mt-3 space-y-1 text-xs text-slate-500">
              <div className="flex justify-between gap-2">
                <dt>criado em</dt>
                <dd className="num">{toISO(orcamento.criadoEm)?.slice(0, 10)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>aprovado em</dt>
                <dd className="num">{toISO(orcamento.aprovadoEm) ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>convertido em</dt>
                <dd className="num">{orcamento.convertidoEm ? toISO(orcamento.convertidoEm)?.slice(0, 10) : '—'}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

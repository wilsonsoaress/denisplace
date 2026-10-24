import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { prisma } from '@/server/db';
import { brl } from '@/domain/money';
import { hoje, toISO } from '@/domain/dates';
import { SITUACAO_LABEL } from '@/domain/cobranca';
import { FORMA_PAGAMENTO, TIPO_EMISSAO } from '@/lib/rotulos';
import { Cabecalho } from '@/ui/pagina';
import { retirarIsencao } from '@/server/acoes/contas';
import { CHIP_SITUACAO, linhaDeTitulo } from '../dados';
import { BotaoDesmarcar, FormEmissaoTitulo, FormEstorno, FormIsencao, FormPagamento } from '../formularios';

export const metadata = { title: 'Título' };

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className="num text-sm font-medium">{children}</dd>
    </div>
  );
}

export default async function TituloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const titulo = await prisma.titulo.findUnique({
    where: { id },
    include: {
      pagamentos: { orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }] },
      contrato: {
        include: { cliente: { select: { id: true, nome: true } }, condominio: { select: { id: true, nome: true } } },
      },
      fatura: {
        include: { itens: { include: { contratoItem: { select: { descricao: true } } }, orderBy: { id: 'asc' } } },
      },
      lotes: { include: { lote: true }, orderBy: { criadoEm: 'desc' } },
    },
  });
  if (!titulo) notFound();

  const l = linhaDeTitulo(titulo, hoje());
  const podePagar = !titulo.pago && !titulo.isento;

  return (
    <>
      <Cabecalho
        titulo={l.numero}
        descricao={`${l.devedor}${l.condominio ? ` · ${l.condominio}` : ''} · competência ${l.comp.slice(0, 7)} · contrato #${l.contratoNumero}`}
        voltar={{ href: '/financeiro/contas-a-receber', label: 'Voltar para contas a receber' }}
        acoes={
          <span className={CHIP_SITUACAO[l.situacao]}>{SITUACAO_LABEL[l.situacao]}</span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Valores</h2>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Dado rotulo="Valor original">{brl(l.valorOriginal)}</Dado>
              <Dado rotulo="Vencimento">
                {l.vencimento}
                {l.dias > 0 ? <span className="ml-1 text-xs text-red-700">{l.dias} dias em atraso</span> : null}
              </Dado>
              <Dado rotulo={l.situacao === 'pago' ? 'Recebido' : 'Saldo hoje'}>
                {l.saldo === null ? 'isento' : brl(l.situacao === 'pago' ? l.recebido : l.saldo)}
              </Dado>
              <Dado rotulo="Multa e juros">
                {l.acr.isZero() ? '—' : brl(l.acr)}
                {!l.acr.isZero() ? (
                  <span className="block text-xs font-normal text-slate-500">
                    {l.situacao === 'vencido' ? '2% + 1% ao mês, correndo sobre o original' : 'cobrados na data do pagamento'}
                  </span>
                ) : null}
              </Dado>
              {l.situacao === 'pago' ? <Dado rotulo="Pago em">{l.pagoEm}</Dado> : null}
              {l.situacao === 'pago' && l.forma ? <Dado rotulo="Forma">{FORMA_PAGAMENTO[l.forma]}</Dado> : null}
            </dl>
            {l.situacao === 'isento' && l.isentoMotivo ? (
              <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Isento: {l.isentoMotivo}
              </p>
            ) : null}
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Pagamentos</h2>
            {podePagar ? (
              <div className="mb-4 border-b border-slate-100 pb-4">
                <FormPagamento tituloId={l.id} saldo={l.saldo ?? l.valorOriginal} vencimento={l.vencimento} />
              </div>
            ) : null}

            {titulo.pagamentos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum pagamento registrado.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {titulo.pagamentos.map((p) => {
                  const data = toISO(p.data);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0"
                    >
                      <div>
                        <b className="num">{brl(p.valor)}</b>
                        <span className="ml-2 text-slate-600">
                          {data} · {FORMA_PAGAMENTO[p.forma]}
                        </span>
                        {p.anulado ? (
                          <span className="chip chip-bad ml-2">
                            estornado {p.anuladoEm ? toISO(p.anuladoEm) : ''}
                          </span>
                        ) : null}
                        {p.comprovanteUrl ? (
                          <a
                            href={p.comprovanteUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="ml-2 text-xs text-blue-800 hover:underline"
                          >
                            comprovante
                          </a>
                        ) : (
                          <span className="ml-2 text-xs text-slate-400">sem comprovante</span>
                        )}
                        {p.observacao ? (
                          <p className="text-xs text-slate-500">{p.observacao}</p>
                        ) : null}
                        {p.anuladoMotivo ? (
                          <p className="text-xs text-slate-500">Motivo do estorno: {p.anuladoMotivo}</p>
                        ) : null}
                      </div>
                      {!p.anulado ? (
                        <details className="w-full sm:w-auto">
                          <summary className="cursor-pointer text-xs text-slate-500 hover:text-red-700">estornar</summary>
                          <div className="mt-2">
                            <FormEstorno tituloId={l.id} pagamento={p} />
                          </div>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Controle de emissão</h2>
              <p className="text-xs text-slate-500">sem integração bancária: você marca o que saiu</p>
            </div>
            <dl className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Boleto</dt>
                <dd className="text-sm">
                  {l.boletoGerado ? (
                    <>
                      <span className="chip chip-ok">emitido</span>
                      <span className="num ml-2 text-xs text-slate-600">{toISO(titulo.boletoEmitidoEm)}</span>
                      {l.nossoNumero ? <span className="num ml-2 text-xs text-slate-600">{l.nossoNumero}</span> : null}
                      <div className="mt-1">
                        <BotaoDesmarcar tituloId={l.id} campo="boleto" rotulo="desmarcar emissão" />
                      </div>
                    </>
                  ) : (
                    <span className="chip chip-bad">não emitido</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Nota fiscal</dt>
                <dd className="text-sm">
                  {l.nfEmitida ? (
                    <>
                      <span className="chip chip-ok">emitida</span>
                      <span className="num ml-2 text-xs text-slate-600">{toISO(titulo.nfEmissaoEm)}</span>
                      {l.nfNumero ? <span className="num ml-2 text-xs text-slate-600">NF {l.nfNumero}</span> : null}
                      <div className="mt-1">
                        <BotaoDesmarcar tituloId={l.id} campo="nf" rotulo="desmarcar emissão" />
                      </div>
                    </>
                  ) : (
                    <span className="chip chip-bad">não emitida</span>
                  )}
                </dd>
              </div>
            </dl>
            <FormEmissaoTitulo tituloId={l.id} />

            {titulo.lotes.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Emissões deste título
                </h3>
                <ul className="space-y-1 text-xs text-slate-600">
                  {titulo.lotes.map(({ lote }) => (
                    <li key={`${lote.id}`} className="flex flex-wrap gap-2">
                      <span className="num">{toISO(lote.criadoEm)?.slice(0, 10)}</span>
                      <b>{TIPO_EMISSAO[lote.tipo]}</b>
                      <span>{lote.descricao}</span>
                      <span className="num">{brl(lote.valorTotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Quem deve</h2>
            <p className="text-sm">{l.devedor}</p>
            <p className="mt-1 text-xs text-slate-500">
              Cliente:{' '}
              <Link href={`/cadastros/clientes/${titulo.contrato.cliente.id}`} className="text-blue-800 hover:underline">
                {titulo.contrato.cliente.nome}
              </Link>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Contrato:{' '}
              <Link href={`/contratos/${titulo.contrato.id}`} className="text-blue-800 hover:underline">
                #{titulo.contrato.numero}
              </Link>
              {titulo.contrato.condominio ? ` · ${titulo.contrato.condominio.nome}` : ''}
            </p>
          </section>

          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Itens da fatura · {toISO(titulo.fatura.competencia)?.slice(0, 7)}
            </h2>
            <ul className="space-y-1 text-sm">
              {titulo.fatura.itens.map((fi) => (
                <li key={fi.id} className="flex items-baseline justify-between gap-2">
                  <span>
                    {fi.contratoItem.descricao}
                    <span className="ml-1 text-xs text-slate-500">× {fi.quantidade.toString()}</span>
                  </span>
                  <span className="num">{brl(fi.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Bruto</dt>
                <dd className="num">{brl(titulo.fatura.valorBruto)}</dd>
              </div>
              {!titulo.fatura.desconto.isZero() ? (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Desconto</dt>
                  <dd className="num text-green-800">-{brl(titulo.fatura.desconto)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between font-medium">
                <dt>Líquido da fatura</dt>
                <dd className="num">{brl(titulo.fatura.valorLiquido)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Preço congelado na competência: {toISO(titulo.fatura.itens[0]?.precoVigencia) ?? '—'}
            </p>
          </section>

          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Isenção de convênio</h2>
            {titulo.isento ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">{titulo.isentoMotivo}</p>
                <form action={retirarIsencao.bind(null, l.id)}>
                  <button type="submit" className="btn">
                    Retirar isenção
                  </button>
                </form>
              </div>
            ) : titulo.pago ? (
              <p className="text-sm text-slate-500">Título quitado: isenção não se aplica.</p>
            ) : (
              <FormIsencao tituloId={l.id} valorOriginal={l.valorOriginal} />
            )}
          </section>
        </div>
      </div>
    </>
  );
}

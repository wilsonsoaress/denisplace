import Link from 'next/link';
import { exigirPagina, podeEditar } from '@/auth/guard';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { prisma } from '@/server/db';
import { brl } from '@/domain/money';
import { hoje, toISO } from '@/domain/dates';
import { SITUACAO_LABEL } from '@/domain/cobranca';
import { FORMA_PAGAMENTO, CATEGORIA_CONTA_PAGAR } from '@/lib/rotulos';
import { Cabecalho } from '@/ui/pagina';
import { CHIP_SITUACAO } from '@/server/relatorios/titulos';
import { linhaDeContaPagar } from '@/server/relatorios/contasPagar';
import { BotaoDesmarcarNf, FormEstornoContaPagar, FormNfContaPagar, FormPagamentoContaPagar } from '../formularios';

export const metadata = { title: 'Lançamento a pagar' };

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className="num text-sm font-medium">{children}</dd>
    </div>
  );
}

export default async function ContaPagarPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPagina('/financeiro/contas-a-pagar/[id]');
  const { id } = await params;
  const editar = await podeEditar('financeiro');

  const contaPagar = await prisma.contaPagar.findUnique({
    where: { id },
    include: {
      pagamentos: { orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }] },
      contrato: { include: { cliente: { select: { id: true, nome: true } } } },
      ordemServico: { select: { id: true, numero: true } },
      origemRecorrente: { select: { id: true, numero: true } },
      geradas: { select: { id: true, numero: true, competencia: true }, orderBy: { competencia: 'asc' } },
    },
  });
  if (!contaPagar) notFound();

  const l = linhaDeContaPagar(contaPagar, hoje());
  const podePagar = !contaPagar.pago;

  return (
    <>
      <Cabecalho
        titulo={l.numero}
        descricao={`${l.fornecedor} · ${CATEGORIA_CONTA_PAGAR[l.categoria]} · competência ${l.comp.slice(0, 7)}`}
        voltar={{ href: '/financeiro/contas-a-pagar', label: 'Voltar para contas a pagar' }}
        acoes={
          <>
            {!editar ? <span className="chip chip-free">somente leitura</span> : null}
            <span className={CHIP_SITUACAO[l.situacao]}>{SITUACAO_LABEL[l.situacao]}</span>
          </>
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
              <Dado rotulo={l.situacao === 'pago' ? 'Pago' : 'Saldo hoje'}>
                {brl(l.situacao === 'pago' ? l.pago : l.saldo)}
              </Dado>
              <Dado rotulo="Multa e juros">
                {l.acr.isZero() ? '—' : brl(l.acr)}
                {!l.encargoPorAtraso ? (
                  <span className="block text-xs font-normal text-slate-500">fornecedor não cobra atraso</span>
                ) : null}
              </Dado>
              {l.situacao === 'pago' ? <Dado rotulo="Pago em">{l.pagoEm}</Dado> : null}
              {l.situacao === 'pago' && l.forma ? <Dado rotulo="Forma">{FORMA_PAGAMENTO[l.forma]}</Dado> : null}
            </dl>
            {contaPagar.descricao ? <p className="mt-3 text-sm text-slate-600">{contaPagar.descricao}</p> : null}
            {contaPagar.observacoes ? (
              <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {contaPagar.observacoes}
              </p>
            ) : null}
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Pagamentos</h2>
            {podePagar && editar ? (
              <div className="mb-4 border-b border-slate-100 pb-4">
                <FormPagamentoContaPagar contaPagarId={l.id} saldo={l.saldo} />
              </div>
            ) : null}

            {contaPagar.pagamentos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum pagamento registrado.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {contaPagar.pagamentos.map((p) => {
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
                          <span className="chip chip-bad ml-2">estornado {p.anuladoEm ? toISO(p.anuladoEm) : ''}</span>
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
                        {p.observacao ? <p className="text-xs text-slate-500">{p.observacao}</p> : null}
                        {p.anuladoMotivo ? <p className="text-xs text-slate-500">Motivo do estorno: {p.anuladoMotivo}</p> : null}
                      </div>
                      {!p.anulado && editar ? (
                        <details className="w-full sm:w-auto">
                          <summary className="cursor-pointer text-xs text-slate-500 hover:text-red-700">estornar</summary>
                          <div className="mt-2">
                            <FormEstornoContaPagar contaPagarId={l.id} pagamento={p} />
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">NF de entrada</h2>
              <p className="text-xs text-slate-500">sem integração: você marca o que recebeu</p>
            </div>
            <dl className="mb-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Nota fiscal</dt>
                <dd className="text-sm">
                  {l.nfRecebida ? (
                    <>
                      <span className="chip chip-ok">recebida</span>
                      <span className="num ml-2 text-xs text-slate-600">{toISO(contaPagar.nfRecebidaEm)}</span>
                      {l.nfNumero ? <span className="num ml-2 text-xs text-slate-600">NF {l.nfNumero}</span> : null}
                      {editar ? (
                        <div className="mt-1">
                          <BotaoDesmarcarNf contaPagarId={l.id} />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span className="chip chip-bad">sem documento</span>
                  )}
                </dd>
              </div>
            </dl>
            {editar && !l.nfRecebida ? <FormNfContaPagar contaPagarId={l.id} /> : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Fornecedor</h2>
            <p className="text-sm">{l.fornecedor}</p>
          </section>

          {contaPagar.contrato ? (
            <section className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Vínculo</h2>
              <p className="text-sm">
                Contrato:{' '}
                <Link href={`/contratos/${contaPagar.contrato.id}`} className="text-blue-800 hover:underline">
                  #{contaPagar.contrato.numero}
                </Link>{' '}
                · {contaPagar.contrato.cliente.nome}
              </p>
            </section>
          ) : null}

          {contaPagar.recorrente || contaPagar.origemRecorrente ? (
            <section className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Recorrência</h2>
              {contaPagar.origemRecorrente ? (
                <p className="text-sm text-slate-600">
                  Gerado do modelo recorrente{' '}
                  <Link href={`/financeiro/contas-a-pagar/${contaPagar.origemRecorrente.id}`} className="text-blue-800 hover:underline">
                    {contaPagar.origemRecorrente.numero}
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">Este é o modelo recorrente: a cada mês gera um lançamento.</p>
                  {contaPagar.geradas.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {contaPagar.geradas.map((g) => (
                        <li key={g.id}>
                          <Link href={`/financeiro/contas-a-pagar/${g.id}`} className="text-blue-800 hover:underline">
                            {g.numero}
                          </Link>{' '}
                          · {toISO(g.competencia)?.slice(0, 7)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

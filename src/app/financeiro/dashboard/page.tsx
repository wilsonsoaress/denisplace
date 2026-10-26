import Link from 'next/link';
import { exigirPagina } from '@/auth/guard';
import type { ReactNode } from 'react';
import { type EscopoCobranca } from '@prisma/client';
import { prisma } from '@/server/db';
import { brl, D, type Money } from '@/domain/money';
import { ESCOPO_COBRANCA } from '@/lib/rotulos';
import { Cabecalho, Vazio } from '@/ui/pagina';
import { lerFiltros, resumoDoPeriodo, type Barra } from './dados';

export const metadata = { title: 'Dashboard financeiro' };

function Kpi({
  rotulo,
  valor,
  nota,
  cor,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  cor?: 'ok' | 'bad';
}) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className={`num mt-1 text-xl font-semibold ${cor === 'bad' ? 'text-red-700' : cor === 'ok' ? 'text-green-700' : ''}`}>
        {valor}
      </p>
      {nota ? <p className="mt-1 text-xs text-slate-500">{nota}</p> : null}
    </div>
  );
}

function Painel({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">{titulo}</h2>
      {children}
      {nota ? <p className="mt-3 text-xs text-slate-500">{nota}</p> : null}
    </section>
  );
}

function LinhaValor({ rotulo, valor, href }: { rotulo: ReactNode; valor: ReactNode; href?: string }) {
  const conteudo = (
    <>
      <span className="text-sm text-slate-700">{rotulo}</span>
      <span className="num text-sm font-medium">{valor}</span>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-baseline justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-slate-100">
      {conteudo}
    </Link>
  ) : (
    <div className="flex items-baseline justify-between gap-3 px-1 py-1.5">{conteudo}</div>
  );
}

function pctTexto(v: number | null): string {
  return v === null ? '—' : `${v}%`;
}

function Barras({ barras }: { barras: Barra[] }) {
  const altura = (v: Money, max: Money) => {
    if (max.isZero()) return 2;
    const p = (v.div(max).times(100).toNumber()) || 0;
    return p > 0 ? Math.max(2, p) : 0;
  };
  const max = barras.reduce<Money>(
    (acc, b) => (b.recebido.plus(b.atraso).plus(b.aVencer).gt(acc) ? b.recebido.plus(b.atraso).plus(b.aVencer) : acc),
    D(0),
  );

  return (
    <div>
      <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height: '176px' }}>
        {barras.map((b) => (
          <div key={b.comp} className="flex h-full min-w-8 flex-1 flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-0.5">
              <div
                className="w-2.5 rounded-t bg-brand"
                style={{ height: `${altura(b.recebido, max)}%` }}
                title={`Recebido ${brl(b.recebido)}`}
              />
              <div
                className="w-2.5 rounded-t bg-red-500"
                style={{ height: `${altura(b.atraso, max)}%` }}
                title={`Em atraso ${brl(b.atraso)}`}
              />
              <div
                className="w-2.5 rounded-t bg-slate-300"
                style={{ height: `${altura(b.aVencer, max)}%` }}
                title={`A vencer ${brl(b.aVencer)}`}
              />
            </div>
            <span className="num mt-1 text-center text-[10px] text-slate-500">{b.comp.slice(5, 7)}/{b.comp.slice(2, 4)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-brand" />recebido</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-red-500" />em atraso</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-slate-300" />a vencer</span>
      </p>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/financeiro/dashboard');
  const filtros = lerFiltros(await searchParams);
  const r = await resumoDoPeriodo(filtros);

  const condominios = await prisma.condominio.findMany({
    select: { id: true, nome: true, cidade: true },
    orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
  });

  const paraGrade = (params: Record<string, string>) => {
    const q = new URLSearchParams(params);
    return `/financeiro/contas-a-receber?${q.toString()}`;
  };

  return (
    <>
      <Cabecalho
        titulo="Dashboard financeiro"
        descricao="Adimplência, atraso e controle de emissão do recorte. Os números são a projeção dos mesmos títulos da grade de contas a receber: mudar o status lá muda aqui."
        acoes={
          <Link href="/financeiro/contas-a-receber" className="btn">
            Abrir contas a receber
          </Link>
        }
      />

      <form action="/financeiro/dashboard" method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-600">
          <span className="field-label">De</span>
          <input type="month" name="de" defaultValue={filtros.de.slice(0, 7)} className="input max-w-52" />
        </label>
        <label className="text-xs text-slate-600">
          <span className="field-label">Até</span>
          <input type="month" name="ate" defaultValue={filtros.ate.slice(0, 7)} className="input max-w-52" />
        </label>
        <label className="text-xs text-slate-600">
          <span className="field-label">Condomínio</span>
          <select name="condominio" defaultValue={filtros.condominioId} className="input max-w-60">
            <option value="">todos</option>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.cidade}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          <span className="field-label">Escopo</span>
          <select name="escopo" defaultValue={filtros.escopo} className="input max-w-60">
            <option value="">todos</option>
            {(Object.keys(ESCOPO_COBRANCA) as EscopoCobranca[]).map((e) => (
              <option key={e} value={e}>
                {ESCOPO_COBRANCA[e]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          Filtrar
        </button>
        <span className="text-xs text-slate-500">
          competência {filtros.de.slice(0, 7)} a {filtros.ate.slice(0, 7)}
        </span>
      </form>

      {r.titulos === 0 ? (
        <Vazio>
          Nenhum título no recorte. Gere a cobrança do mês em <Link href="/contratos" className="underline">Contratos</Link> ou
          amplie o período.
        </Vazio>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi
              rotulo="Receita recorrente do período"
              valor={brl(r.receitas.recorrente)}
              nota={`${r.titulos} títulos · ${r.contratos} contratos · isentos fora`}
            />
            <Kpi
              rotulo="Recebido no período"
              valor={brl(r.receitas.recebido)}
              nota={`adimplência ${pctTexto(r.adimplencia)} do valor devido`}
              cor={r.adimplencia !== null && r.adimplencia >= 90 ? 'ok' : 'bad'}
            />
            <Kpi
              rotulo="Em atraso"
              valor={brl(r.receitas.atraso)}
              nota={`${r.vencidos} título(s) vencido(s), com multa e juros de hoje`}
              cor={r.receitas.atraso.isZero() ? undefined : 'bad'}
            />
            <Kpi rotulo="A vencer" valor={brl(r.receitas.aVencer)} nota="dentro do vencimento, sem acréscimo" />
            <Kpi
              rotulo="MRR"
              valor={brl(r.receitas.mrr)}
              nota={
                r.mrrCompetencia
                  ? `competência ${r.mrrCompetencia.slice(0, 7)} — contratos com cobrança no mês`
                  : 'sem cobrança na janela'
              }
            />
            <Kpi rotulo="Receita isenta" valor={brl(r.receitas.isento)} nota="isenção marcada no título: não entra em adimplência nem em MRR" />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Painel
              titulo="Recebido × devido por competência"
              nota="Cada mês tem três barras: o que entrou, o que está vencido hoje e o que ainda vai vencer."
            >
              <Barras barras={r.barras} />
            </Painel>

            <Painel
              titulo="Adimplência por competência"
              nota="Pago ÷ (pago + vencido em aberto), por valor. A competência corrente ainda em dia aparece alta porque nada venceu."
            >
              {r.barras.map((b) => (
                <LinhaValor
                  key={b.comp}
                  rotulo={
                    <>
                      {b.comp.slice(0, 7)} <span className="num text-xs text-slate-500">· devido {brl(b.devido)}</span>
                    </>
                  }
                  valor={
                    <span className={b.adimplencia !== null && b.adimplencia < 90 ? 'text-red-700' : 'text-green-700'}>
                      {pctTexto(b.adimplencia)}
                    </span>
                  }
                />
              ))}
            </Painel>

            <Painel
              titulo="Maiores devedores no recorte"
              nota="Saldo com multa e juros de hoje. Clique para abrir o título na grade."
            >
              {r.devedores.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum vencido no recorte.</p>
              ) : (
                r.devedores.map((d) => (
                  <LinhaValor
                    key={d.nome}
                    href={paraGrade({ q: d.nome, situacao: 'vencido' })}
                    rotulo={
                      <>
                        {d.nome}
                        <span className="block text-xs text-slate-500">
                          {d.condominio ? `${d.condominio} · ` : ''}
                          {d.titulos} título(s) · até {d.dias} dias
                        </span>
                      </>
                    }
                    valor={<span className="text-red-700">{brl(d.saldo)}</span>}
                  />
                ))
              )}
            </Painel>

            <Painel
              titulo="Controle de emissão (sem integração bancária)"
              nota="Estes contadores existem porque não há retorno de banco: a tela é a fonte da verdade."
            >
              <LinhaValor
                href={paraGrade({ controle: 'sem_boleto' })}
                rotulo={<>Boletos <b>não gerados</b></>}
                valor={`${r.emissao.semBoleto} · ${brl(r.emissao.semBoletoValor)}`}
              />
              <LinhaValor
                href={paraGrade({ controle: 'sem_nf' })}
                rotulo={<>Notas fiscais <b>não emitidas</b></>}
                valor={`${r.emissao.semNf} · ${brl(r.emissao.semNfValor)}`}
              />
              <LinhaValor
                rotulo={<>Recebimentos <b>sem comprovante</b></>}
                valor={r.emissao.semComprovante}
              />
            </Painel>

            <Painel
              titulo="Composição da receita"
              nota="Valor faturado por item do contrato, sem as isenções: soma exatamente a receita recorrente do período."
            >
              {r.composicao.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma fatura no recorte.</p>
              ) : (
                r.composicao.map((c) => (
                  <LinhaValor
                    key={c.descricao}
                    rotulo={<>
                      {c.descricao} <span className="text-xs text-slate-500">· {c.share.toLocaleString('pt-BR')}%</span>
                    </>}
                    valor={brl(c.total)}
                  />
                ))
              )}
            </Painel>

            <Painel
              titulo="Contas a pagar e margem por contrato"
              nota="O lugar está reservado: na F2 o custo direto (equipamento, peças, horas) entra vinculado ao contrato e este painel passa a mostrar recebido − despesas do recorte."
            >
              <LinhaValor rotulo="Recebido no recorte" valor={brl(r.receitas.recebido)} />
              <LinhaValor rotulo="Custo direto do recorte" valor={<span className="text-slate-400">chega com a F2</span>} />
            </Painel>
          </div>
        </>
      )}
    </>
  );
}

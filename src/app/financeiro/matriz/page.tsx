import Link from 'next/link';
import { exigirPagina } from '@/auth/guard';
import { type EscopoCobranca } from '@prisma/client';
import { prisma } from '@/server/db';
import { brl, D, type Money } from '@/domain/money';
import { ESCOPO_COBRANCA } from '@/lib/rotulos';
import { Cabecalho, Vazio } from '@/ui/pagina';
import { CELULA_CLASSE, CELULA_ROTULO, lerFiltros, matrizDoPeriodo, type Celda, type LinhaMatriz } from './dados';

export const metadata = { title: 'Matriz de inadimplência' };

const SEM_SIMBOLO = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function moeda(v: Money): string {
  return SEM_SIMBOLO.format(v.toNumber());
}

function pct(v: number | null): string {
  return v === null ? '—' : `${v}%`;
}

function Celula({ celda, href }: { celda: Celda | undefined; href: string }) {
  if (!celda) {
    return <td className="border-b border-slate-100 px-1 py-1.5 text-center text-slate-300">·</td>;
  }
  const mostrado =
    celda.situacao === 'pago' ? celda.recebido : celda.situacao === 'isento' ? D(0) : celda.saldo;
  const dica = `${CELULA_ROTULO[celda.situacao]} · devido ${brl(celda.devido)} · recebido ${brl(celda.recebido)} · saldo ${brl(celda.saldo)}`;
  return (
    <td className={`border-b border-slate-100 px-1 py-1.5 text-right ${CELULA_CLASSE[celda.situacao]}`}>
      <Link href={href} className="num block hover:underline" title={dica}>
        {celda.situacao === 'isento' ? 'isenta' : moeda(mostrado)}
      </Link>
    </td>
  );
}

export default async function MatrizPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/financeiro/matriz');
  const filtros = lerFiltros(await searchParams);
  const m = await matrizDoPeriodo(filtros);

  const condominios = await prisma.condominio.findMany({
    select: { id: true, nome: true, cidade: true },
    orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
  });

  const paraGrade = (l: LinhaMatriz, comp?: string) => {
    const q = new URLSearchParams({ q: l.devedor });
    if (comp) q.set('competencia', comp.slice(0, 7));
    if (filtros.condominioId) q.set('condominio', filtros.condominioId);
    return `/financeiro/contas-a-receber?${q.toString()}`;
  };

  return (
    <>
      <Cabecalho
        titulo="Matriz de inadimplência"
        descricao="Devedor × competência, projetada dos títulos. Nada é editado aqui: a baixa acontece em contas a receber e esta grade reflete na mesma hora."
        acoes={
          <Link href="/financeiro/contas-a-receber" className="btn">
            Abrir contas a receber
          </Link>
        }
      />

      <form action="/financeiro/matriz" method="get" className="mb-4 flex flex-wrap items-end gap-2">
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
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="atraso"
            value="1"
            defaultChecked={filtros.somenteComAtraso}
            className="h-4 w-4 rounded border-slate-300"
          />
          só devedores com atraso
        </label>
        <button type="submit" className="btn btn-primary">
          Filtrar
        </button>
      </form>

      {m.linhas.length === 0 ? (
        <Vazio>Nenhum título no recorte. Gere a cobrança do mês ou amplie o período.</Vazio>
      ) : (
        <>
          <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <p className="card !py-2">
              Devedores: <b className="num">{m.linhas.length}</b>
              <span className="block text-xs text-slate-500">{m.total.titulos} títulos gerados no período</span>
            </p>
            <p className="card !py-2">
              Em aberto: <b className="num">{brl(m.total.emAberto)}</b>
              <span className="block text-xs text-slate-500">saldo com multa e juros de hoje</span>
            </p>
            <p className="card !py-2">
              Em atraso: <b className="num text-red-700">{brl(m.total.emAtraso)}</b>
              <span className="block text-xs text-slate-500">só o que já venceu</span>
            </p>
            <p className="card !py-2">
              Adimplência: <b className="num">{pct(m.total.adimplencia)}</b>
              <span className="block text-xs text-slate-500">pago ÷ (pago + vencido), isento fora</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="data min-w-max text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left">Devedor</th>
                  {m.comps.map((c) => (
                    <th key={c} className="num px-1 py-2 text-right font-medium text-slate-500">
                      {c.slice(5, 7)}/{c.slice(2, 4)}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium text-slate-500">em aberto</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-500">em atraso</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-500">adimpl.</th>
                </tr>
              </thead>
              <tbody>
                {m.linhas.map((l) => (
                  <tr key={l.chave} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-10 max-w-64 border-b border-slate-100 bg-white px-2 py-1.5">
                      <Link href={paraGrade(l)} className="font-medium text-slate-800 hover:underline">
                        {l.devedor}
                      </Link>
                      <span className="block text-[10px] text-slate-500">
                        {l.condominio ? `${l.condominio} · ` : ''}
                        {l.escopo === 'UNIDADE' ? 'por unidade' : 'condomínio'}
                      </span>
                    </td>
                    {m.comps.map((c) => (
                      <Celula key={c} celda={l.celulas.get(c)} href={paraGrade(l, c)} />
                    ))}
                    <td className="num border-b border-slate-100 px-2 py-1.5 text-right">{moeda(l.emAberto)}</td>
                    <td className={`num border-b border-slate-100 px-2 py-1.5 text-right ${l.emAtraso.isZero() ? 'text-slate-400' : 'font-medium text-red-700'}`}>
                      {moeda(l.emAtraso)}
                    </td>
                    <td className="num border-b border-slate-100 px-2 py-1.5 text-right">{pct(l.adimplencia)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-medium">
                  <td className="sticky left-0 z-10 bg-slate-100 px-2 py-2">Adimplência da competência</td>
                  {m.colunas.map((c) => (
                    <td
                      key={c.comp}
                      className="num px-1 py-2 text-right"
                      title={`devido ${brl(c.devido)} · em aberto ${brl(c.emAberto)} · em atraso ${brl(c.emAtraso)}`}
                    >
                      {pct(c.adimplencia)}
                    </td>
                  ))}
                  <td className="num px-2 py-2 text-right">{moeda(m.total.emAberto)}</td>
                  <td className="num px-2 py-2 text-right text-red-700">{moeda(m.total.emAtraso)}</td>
                  <td className="num px-2 py-2 text-right">{pct(m.total.adimplencia)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-100" />paga (recebido)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-100" />vencida (saldo)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-amber-100" />a vencer (valor)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-slate-100" />isenta</span>
            <span className="text-slate-500">valores em R$ · passe o mouse na célula para ver devido, recebido e saldo</span>
          </p>
          {m.cortada ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              A matriz foi cortada em 300 devedores: filtre por condomínio ou reduza o período para ver o resto.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

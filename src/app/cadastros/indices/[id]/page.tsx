import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { salvarIndice, salvarValorIndice } from '@/server/acoes/indices';
import { acumuladoPercentual } from '@/domain/reajuste';
import { addMonths, competencia, hoje, toISO } from '@/domain/dates';
import { brl, brlPct } from '@/domain/money';
import { Cabecalho, Vazio } from '@/ui/pagina';
import { Campo, Formulario, Texto } from '@/ui/form';

export const metadata = { title: 'Índice de reajuste' };

export default async function IndicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const salvo = (await searchParams).salvo !== undefined;

  const indice = await prisma.indiceReajuste.findUnique({
    where: { id },
    include: {
      valores: { orderBy: { competencia: 'desc' }, take: 60 },
      contratoItens: {
        include: { contrato: { select: { numero: true, status: true } } },
        orderBy: { vigenciaDesde: 'desc' },
        take: 30,
      },
    },
  });
  if (!indice) notFound();

  const serie = indice.valores
    .map((v) => ({ competencia: toISO(v.competencia) ?? '', variacaoMensal: v.variacaoMensal }))
    .sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  const ultima = serie.at(-1)?.competencia ?? competencia(hoje());
  const acumulado12 = acumuladoPercentual(serie, addMonths(ultima, -11), ultima);
  const proxima = addMonths(ultima, 1);

  return (
    <>
      <Cabecalho
        titulo={indice.nome}
        descricao={`Última competência informada: ${ultima.slice(0, 7)} · acumulado 12 meses: ${
          acumulado12 === null ? 'série incompleta' : brlPct(acumulado12)
        }`}
        voltar={{ href: '/cadastros/indices', label: 'Voltar para índices' }}
      />
      {salvo ? (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Índice salvo.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Índice</h2>
            <Formulario acao={salvarIndice.bind(null, indice.id)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo nome="sigla" rotulo="Sigla" obrigatorio>
                  <Texto nome="sigla" valor={indice.sigla} obrigatorio />
                </Campo>
                <Campo nome="nome" rotulo="Nome" obrigatorio>
                  <Texto nome="nome" valor={indice.nome} obrigatorio />
                </Campo>
              </div>
            </Formulario>
          </section>

          <section className="card">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Registrar variação mensal
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Competência no primeiro dia do mês. Reescrever a mesma competência corrige o valor.
            </p>
            <Formulario acao={salvarValorIndice.bind(null, indice.id)} textoSubmit="Registrar">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo nome="competencia" rotulo="Competência" obrigatorio>
                  <Texto nome="competencia" tipo="date" valor={proxima} obrigatorio />
                </Campo>
                <Campo nome="variacaoMensal" rotulo="Variação no mês (%)" obrigatorio dica="Negativo em deflação.">
                  <Texto nome="variacaoMensal" placeholder="0,48" obrigatorio />
                </Campo>
              </div>
            </Formulario>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Série ({serie.length} valores)
            </h2>
            {serie.length === 0 ? (
              <Vazio>Nenhum valor informado — reajuste com este índice fica bloqueado.</Vazio>
            ) : (
              <div className="max-h-[24rem] overflow-auto">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Competência</th>
                      <th className="num">Variação mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...serie].reverse().map((p) => (
                      <tr key={p.competencia}>
                        <td className="num">{p.competencia.slice(0, 7)}</td>
                        <td className="num">{brlPct(p.variacaoMensal, 6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Itens de contrato que usam este índice ({indice.contratoItens.length})
            </h2>
            {indice.contratoItens.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum ainda.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                {indice.contratoItens.map((ci) => (
                  <li key={ci.id} className="flex items-center justify-between gap-2">
                    <Link href={`/contratos/${ci.contratoId}`} className="text-blue-800 hover:underline">
                      #{ci.contrato.numero} · {ci.descricao} ({brl(ci.precoAtual)})
                    </Link>
                    <span className="num text-xs text-slate-500">
                      próximo em {toISO(ci.proximoReajusteEm) ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

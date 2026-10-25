import Link from 'next/link';
import { exigirPagina } from '@/auth/guard';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { salvarCatalogoItem } from '@/server/acoes/catalogo';
import { brl } from '@/domain/money';
import { toISO } from '@/domain/dates';
import { PERIODICIDADE_REAJUSTE, STATUS_CONTRATO } from '@/lib/rotulos';
import { Cabecalho } from '@/ui/pagina';
import { FormCatalogoItem } from '../form';

export const metadata = { title: 'Item de catálogo' };

export default async function CatalogoItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/cadastros/catalogo/[id]');
  const { id } = await params;
  const salvo = (await searchParams).salvo !== undefined;

  const item = await prisma.catalogoItem.findUnique({
    where: { id },
    include: {
      itens: {
        include: { contrato: { include: { cliente: true } } },
        orderBy: { vigenciaDesde: 'desc' },
        take: 40,
      },
    },
  });
  if (!item) notFound();

  const indices = await prisma.indiceReajuste.findMany({ orderBy: { sigla: 'asc' } });

  return (
    <>
      <Cabecalho
        titulo={item.nome}
        descricao={`Preço público ${brl(item.precoPublico)} · custo ${brl(item.custoReferencia)}`}
        voltar={{ href: '/cadastros/catalogo', label: 'Voltar para o catálogo' }}
      />
      {salvo ? (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Item salvo. O preço público é referência: contratos já assinados mantêm o próprio preço.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card">
          <FormCatalogoItem acao={salvarCatalogoItem.bind(null, item.id)} registro={item} indices={indices} />
        </section>
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Preço praticado nos contratos ({item.itens.length})
          </h2>
          {item.itens.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum contrato usa este item ainda.</p>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Contrato</th>
                    <th className="num">Qtd.</th>
                    <th className="num">Preço atual</th>
                    <th>Vigente desde</th>
                    <th>Reajuste</th>
                  </tr>
                </thead>
                <tbody>
                  {item.itens.map((ci) => (
                    <tr key={ci.id}>
                      <td>
                        <Link href={`/contratos/${ci.contratoId}`} className="text-blue-800 hover:underline">
                          #{ci.contrato.numero}
                        </Link>
                        <span className="ml-1 text-xs text-slate-500">{ci.contrato.cliente.nome}</span>
                        <span className="chip chip-free ml-1">{STATUS_CONTRATO[ci.contrato.status]}</span>
                      </td>
                      <td className="num">{ci.quantidade.toString()}</td>
                      <td className="num">{brl(ci.precoAtual)}</td>
                      <td className="num text-xs">{toISO(ci.vigenciaDesde)}</td>
                      <td className="text-xs">{PERIODICIDADE_REAJUSTE[ci.periodicidade]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

import Link from 'next/link';
import { exigirPagina } from '@/auth/guard';
import { prisma } from '@/server/db';
import { acumuladoPercentual } from '@/domain/reajuste';
import { addMonths, toISO } from '@/domain/dates';
import { brlPct } from '@/domain/money';
import { Cabecalho, Vazio } from '@/ui/pagina';

export const metadata = { title: 'Índices de reajuste' };

export default async function IndicesPage() {
  await exigirPagina('/cadastros/indices');
  const indices = await prisma.indiceReajuste.findMany({
    include: {
      valores: { orderBy: { competencia: 'asc' } },
      _count: { select: { contratoItens: true } },
    },
    orderBy: { sigla: 'asc' },
  });

  return (
    <>
      <Cabecalho
        titulo="Índices de reajuste"
        descricao="IPCA, IGP-M e INPC por competência. O acumulado é o produto composto das variações mensais; sem a série completa do período o sistema barra o reajuste em vez de estimar."
        voltar={{ href: '/cadastros', label: 'Voltar para cadastros' }}
        acoes={
          <Link href="/cadastros/indices/novo" className="btn btn-primary">
            Novo índice
          </Link>
        }
      />

      {indices.length === 0 ? (
        <Vazio>
          Nenhum índice cadastrado.{' '}
          <Link href="/cadastros/indices/novo" className="text-blue-800 underline">
            Criar o primeiro.
          </Link>
        </Vazio>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="grid">
            <thead>
              <tr>
                <th>Sigla</th>
                <th>Nome</th>
                <th className="num">Valores</th>
                <th className="num">Última competência</th>
                <th className="num">Acumulado 12m</th>
                <th className="num">Itens de contrato</th>
              </tr>
            </thead>
            <tbody>
              {indices.map((i) => {
                const serie = i.valores.map((v) => ({
                  competencia: toISO(v.competencia) ?? '',
                  variacaoMensal: v.variacaoMensal,
                }));
                const ultima = toISO(i.valores.at(-1)?.competencia);
                const acumulado = ultima
                  ? acumuladoPercentual(serie, addMonths(ultima, -11), ultima)
                  : null;
                return (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/cadastros/indices/${i.id}`} className="font-medium text-blue-800 hover:underline">
                        {i.sigla}
                      </Link>
                    </td>
                    <td>{i.nome}</td>
                    <td className="num">{i.valores.length}</td>
                    <td className="num text-xs">{ultima ?? '—'}</td>
                    <td className="num">{acumulado === null ? 'série incompleta' : brlPct(acumulado)}</td>
                    <td className="num">{i._count.contratoItens}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

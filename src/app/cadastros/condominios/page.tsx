import Link from 'next/link';
import { exigirPagina } from '@/auth/guard';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { Cabecalho, Filtro, Vazio } from '@/ui/pagina';

export const metadata = { title: 'Condomínios' };

export default async function CondominiosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/cadastros/condominios');
  const bruto = await searchParams;
  const q = typeof bruto.q === 'string' ? bruto.q : '';

  const where: Prisma.CondominioWhereInput = q
    ? {
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { cidade: { contains: q, mode: 'insensitive' } },
          { cnpj: { contains: q } },
        ],
      }
    : {};

  const condominios = await prisma.condominio.findMany({
    where,
    include: {
      cliente: { select: { id: true, nome: true } },
      _count: { select: { unidades: true, contratos: true } },
    },
    orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
    take: 200,
  });

  return (
    <>
      <Cabecalho
        titulo="Condomínios e unidades"
        descricao="O condomínio é o local; a unidade é o que aparece no boleto quando a cobrança é por morador."
        voltar={{ href: '/cadastros', label: 'Voltar para cadastros' }}
        acoes={
          <Link href="/cadastros/condominios/novo" className="btn btn-primary">
            Novo condomínio
          </Link>
        }
      />
      <Filtro acao="/cadastros/condominios" q={q} placeholder="Nome, cidade ou CNPJ" />

      {condominios.length === 0 ? (
        <Vazio>
          Nenhum condomínio encontrado{q ? ` para “${q}”` : ''}.{' '}
          <Link href="/cadastros/condominios/novo" className="text-blue-800 underline">
            Cadastrar.
          </Link>
        </Vazio>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="grid">
            <thead>
              <tr>
                <th>Condomínio</th>
                <th>Cidade</th>
                <th>Cliente que assina</th>
                <th>Síndico</th>
                <th className="num">Unidades</th>
                <th className="num">Contratos</th>
              </tr>
            </thead>
            <tbody>
              {condominios.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/cadastros/condominios/${c.id}`} className="font-medium text-blue-800 hover:underline">
                      {c.nome}
                    </Link>
                  </td>
                  <td>{c.cidade ?? '—'}</td>
                  <td>
                    {c.cliente ? (
                      <Link href={`/cadastros/clientes/${c.cliente.id}`} className="text-blue-800 hover:underline">
                        {c.cliente.nome}
                      </Link>
                    ) : (
                      <span className="chip chip-free">por unidade</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-600">{c.sindicoNome ?? '—'}</td>
                  <td className="num">{c._count.unidades}</td>
                  <td className="num">{c._count.contratos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

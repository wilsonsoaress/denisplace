import Link from 'next/link';
import { exigirPagina } from '@/auth/guard';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { Cabecalho, Filtro, Vazio, param } from '@/ui/pagina';
import { TIPO_PESSOA } from '@/lib/rotulos';

export const metadata = { title: 'Clientes' };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/cadastros/clientes');
  const q = await param(searchParams, 'q');
  const inativos = (await param(searchParams, 'inativos')) === '1';

  const where: Prisma.ClienteWhereInput = {
    ...(inativos ? {} : { ativo: true }),
    ...(q
      ? {
          OR: [
            { nome: { contains: q, mode: 'insensitive' } },
            { documento: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const clientes = await prisma.cliente.findMany({
    where,
    include: { _count: { select: { contratos: true } } },
    orderBy: { nome: 'asc' },
    take: 200,
  });

  return (
    <>
      <Cabecalho
        titulo="Clientes"
        descricao="Quem contrata e quem recebe o boleto. Marque “este cliente é o próprio condomínio” quando o condomínio assina e paga um boleto único."
        acoes={
          <Link href="/cadastros/clientes/novo" className="btn btn-primary">
            Novo cliente
          </Link>
        }
      />
      <Filtro acao="/cadastros/clientes" q={q} placeholder="Nome, CPF/CNPJ ou e-mail">
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="hidden" name="inativos" value="0" />
          <input type="checkbox" name="inativos" value="1" defaultChecked={inativos} className="size-4" />
          incluir inativos
        </label>
      </Filtro>

      {clientes.length === 0 ? (
        <Vazio>
          Nenhum cliente encontrado{q ? ` para “${q}”` : ''}.{' '}
          <Link href="/cadastros/clientes/novo" className="text-blue-800 underline">
            Cadastre o primeiro.
          </Link>
        </Vazio>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="grid">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>CPF / CNPJ</th>
                <th>Cidade</th>
                <th>Contatos</th>
                <th className="num">Contratos</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/cadastros/clientes/${c.id}`} className="font-medium text-blue-800 hover:underline">
                      {c.nome}
                    </Link>
                    {c.ehCondominio ? <span className="chip chip-free ml-2">condomínio</span> : null}
                  </td>
                  <td>{TIPO_PESSOA[c.tipo]}</td>
                  <td className="num">{c.documento ?? '—'}</td>
                  <td>{c.cidade ?? '—'}</td>
                  <td className="text-xs text-slate-600">
                    {[c.telefone, c.email].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="num">{c._count.contratos}</td>
                  <td>
                    <span className={`chip ${c.ativo ? 'chip-ok' : 'chip-free'}`}>
                      {c.ativo ? 'ativo' : 'inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

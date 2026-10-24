import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { brl, brlPct, D } from '@/domain/money';
import { TIPO_CATALOGO, UNIDADE_COBRANCA } from '@/lib/rotulos';
import { Cabecalho, Filtro, Vazio } from '@/ui/pagina';

export const metadata = { title: 'Catálogo' };

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const bruto = await searchParams;
  const q = typeof bruto.q === 'string' ? bruto.q : '';
  const tipo = typeof bruto.tipo === 'string' ? bruto.tipo : '';

  const where: Prisma.CatalogoItemWhereInput = {
    ...(tipo === 'SERVICO' || tipo === 'EQUIPAMENTO' ? { tipo } : {}),
    ...(q ? { nome: { contains: q, mode: 'insensitive' } } : {}),
  };

  const itens = await prisma.catalogoItem.findMany({
    where,
    include: { indiceReajuste: true, _count: { select: { itens: true } } },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
  });

  return (
    <>
      <Cabecalho
        titulo="Catálogo"
        descricao="Serviços e equipamentos com preço público e custo de referência. O preço efetivamente cobrado vive no item do contrato, com seu histórico de reajuste."
        voltar={{ href: '/cadastros', label: 'Voltar para cadastros' }}
        acoes={
          <Link href="/cadastros/catalogo/novo" className="btn btn-primary">
            Novo item
          </Link>
        }
      />
      <Filtro acao="/cadastros/catalogo" q={q} placeholder="Nome do item">
        <select name="tipo" defaultValue={tipo} className="input max-w-48">
          <option value="">Serviços e equipamentos</option>
          <option value="SERVICO">Só serviços</option>
          <option value="EQUIPAMENTO">Só equipamentos</option>
        </select>
      </Filtro>

      {itens.length === 0 ? (
        <Vazio>
          Nenhum item no catálogo.{' '}
          <Link href="/cadastros/catalogo/novo" className="text-blue-800 underline">
            Cadastrar o primeiro.
          </Link>
        </Vazio>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="grid">
            <thead>
              <tr>
                <th>Item</th>
                <th>Tipo</th>
                <th>Cobrança</th>
                <th className="num">Preço público</th>
                <th className="num">Custo</th>
                <th className="num">Margem</th>
                <th>Reajuste</th>
                <th className="num">Em contratos</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => {
                const margem = i.precoPublico.greaterThan(0)
                  ? D(i.precoPublico)
                      .minus(i.custoReferencia)
                      .div(i.precoPublico)
                      .mul(100)
                  : null;
                return (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/cadastros/catalogo/${i.id}`} className="font-medium text-blue-800 hover:underline">
                        {i.nome}
                      </Link>
                      {!i.ativo ? <span className="chip chip-free ml-2">inativo</span> : null}
                    </td>
                    <td>{TIPO_CATALOGO[i.tipo]}</td>
                    <td>{UNIDADE_COBRANCA[i.unidadeCobranca]}</td>
                    <td className="num">{brl(i.precoPublico)}</td>
                    <td className="num">{brl(i.custoReferencia)}</td>
                    <td className="num">{margem === null ? '—' : brlPct(margem)}</td>
                    <td>{i.indiceReajuste?.sigla ?? 'fixo'}</td>
                    <td className="num">{i._count.itens}</td>
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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Cliente, Unidade } from '@prisma/client';
import { prisma } from '@/server/db';
import { alternarUnidade, salvarCondominio, salvarUnidade } from '@/server/acoes/condominios';
import { Cabecalho } from '@/ui/pagina';
import { STATUS_CONTRATO } from '@/lib/rotulos';
import { toISO } from '@/domain/dates';
import { Campo, Escolha, Formulario, Texto, type EstadoForm } from '@/ui/form';
import { FormCondominio } from '../form';

export const metadata = { title: 'Condomínio' };

function FormUnidade({
  acao,
  registro,
  moradores,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: Unidade | null;
  moradores: Pick<Cliente, 'id' | 'nome'>[];
}) {
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar unidade' : 'Adicionar unidade'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nome="codigo"
          rotulo="Código no boleto"
          obrigatorio
          dica='Como aparece na linha digitável e na matriz, ex. "Casa 12 - bloco A".'
        >
          <Texto nome="codigo" valor={registro?.codigo} obrigatorio />
        </Campo>
        <Campo nome="titularId" rotulo="Morador titular" dica="Quem mora aí hoje; trocar aqui não reescreve contrato.">
          <Escolha
            nome="titularId"
            valor={registro?.titularId ?? undefined}
            opcoes={[
              { value: '', label: '— sem titular definido —' },
              ...moradores.map((m) => ({ value: m.id, label: m.nome })),
            ]}
          />
        </Campo>
        <Campo nome="bloco" rotulo="Bloco / torre">
          <Texto nome="bloco" valor={registro?.bloco ?? undefined} />
        </Campo>
        <Campo nome="numero" rotulo="Número">
          <Texto nome="numero" valor={registro?.numero ?? undefined} />
        </Campo>
      </div>
    </Formulario>
  );
}

export default async function CondominioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const bruto = await searchParams;
  const salvo = bruto.salvo !== undefined;
  const editar = typeof bruto.editar === 'string' ? bruto.editar : null;

  const condominio = await prisma.condominio.findUnique({
    where: { id },
    include: {
      unidades: {
        include: { titular: true, equipamentos: { select: { id: true } } },
        orderBy: { codigo: 'asc' },
      },
      contratos: { include: { cliente: true }, orderBy: { inicio: 'desc' } },
      equipamentos: { orderBy: { numeroSerie: 'asc' } },
    },
  });
  if (!condominio) notFound();

  const moradores = await prisma.cliente.findMany({
    where: { ativo: true, tipo: 'PF' },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
    take: 500,
  });
  const assinantes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
    take: 500,
  });
  const alvo = editar
    ? await prisma.unidade.findFirst({ where: { id: editar, condominioId: id }, include: { titular: true } })
    : null;
  if (editar && !alvo) notFound();

  const ativas = condominio.unidades.filter((u) => u.ativa).length;

  return (
    <>
      <Cabecalho
        titulo={condominio.nome}
        descricao={`${condominio.cidade ?? 'cidade não informada'} · ${ativas} unidades ativas de ${
          condominio.unidades.length
        } · ${condominio.equipamentos.length} equipamentos`}
        voltar={{ href: '/cadastros/condominios', label: 'Voltar para condomínios' }}
      />
      {salvo ? (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Condomínio salvo.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dados do condomínio</h2>
            <FormCondominio
              acao={salvarCondominio.bind(null, condominio.id)}
              registro={condominio}
              clientes={assinantes}
            />
          </section>

          <section className="card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Unidades ({condominio.unidades.length})
              </h2>
              {editar ? (
                <Link href={`/cadastros/condominios/${condominio.id}`} className="text-xs text-slate-500 hover:text-red-700">
                  cancelar edição
                </Link>
              ) : null}
            </div>

            {condominio.unidades.length === 0 ? (
              <p className="mb-3 text-sm text-slate-500">
                Nenhuma unidade cadastrada. Use a cobrança por unidade só depois de cadastrar as casas/apartamentos.
              </p>
            ) : (
              <div className="mb-4 max-h-96 overflow-auto">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Morador titular</th>
                      <th className="num">Equip.</th>
                      <th>Situação</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {condominio.unidades.map((u) => (
                      <tr key={u.id}>
                        <td className="font-medium">{u.codigo}</td>
                        <td>
                          {u.titular ? (
                            <Link href={`/cadastros/clientes/${u.titular.id}`} className="text-blue-800 hover:underline">
                              {u.titular.nome}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="num">{u.equipamentos.length}</td>
                        <td>
                          <span className={`chip ${u.ativa ? 'chip-ok' : 'chip-free'}`}>{u.ativa ? 'ativa' : 'inativa'}</span>
                        </td>
                        <td className="space-x-2 whitespace-nowrap text-xs">
                          <Link href={`/cadastros/condominios/${condominio.id}?editar=${u.id}`} className="text-blue-800 hover:underline">
                            editar
                          </Link>
                          <form action={alternarUnidade.bind(null, condominio.id, u.id, !u.ativa)}>
                            <button type="submit" className="text-slate-500 hover:text-red-700">
                              {u.ativa ? 'inativar' : 'reativar'}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {alvo ? `Editar unidade ${alvo.codigo}` : 'Nova unidade'}
            </h3>
            <FormUnidade
              acao={salvarUnidade.bind(null, condominio.id, alvo?.id ?? null)}
              registro={alvo}
              moradores={moradores}
            />
            {alvo ? (
              <Link
                href={`/cadastros/condominios/${condominio.id}`}
                className="mt-2 inline-block text-xs text-slate-500 hover:text-blue-800"
              >
                adicionar outra unidade no lugar
              </Link>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Contratos ({condominio.contratos.length})
            </h2>
            {condominio.contratos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum contrato para este condomínio.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {condominio.contratos.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/contratos/${c.id}`} className="text-blue-800 hover:underline">
                      #{c.numero} · {c.cliente.nome}
                    </Link>
                    <span className="num text-xs text-slate-500">{toISO(c.inicio)}</span>
                    <span className="chip chip-free">{STATUS_CONTRATO[c.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Equipamentos ({condominio.equipamentos.length})
            </h2>
            {condominio.equipamentos.length === 0 ? (
              <p className="text-sm text-slate-500">Nada instalado ainda.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-auto text-sm">
                {condominio.equipamentos.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <span>{e.modelo}</span>
                    <span className="num text-xs text-slate-500">{e.numeroSerie}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/cadastros/equipamentos" className="mt-2 inline-block text-xs text-blue-800 hover:underline">
              Gerenciar equipamentos →
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}

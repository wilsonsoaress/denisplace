import Link from 'next/link';
import { exigirPagina, soAdmin } from '@/auth/guard';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { anonimizarCliente, salvarCliente } from '@/server/acoes/clientes';
import { Cabecalho } from '@/ui/pagina';
import { STATUS_CONTRATO } from '@/lib/rotulos';
import { FormCliente, FormLgpd } from '../form';

export const metadata = { title: 'Cliente' };

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/cadastros/clientes/[id]');
  const admin = 'usuario' in (await soAdmin());
  const { id } = await params;
  const salvo = (await searchParams).salvo !== undefined;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      contratos: {
        include: { condominio: true },
        orderBy: { inicio: 'desc' },
      },
      condominios: true,
    },
  });
  if (!cliente) notFound();

  return (
    <>
      <Cabecalho
        titulo={cliente.nome}
        descricao={`Cliente ${cliente.tipo === 'PF' ? 'pessoa física' : 'pessoa jurídica'}${
          cliente.ehCondominio ? ' · é o próprio condomínio' : ''
        }`}
        voltar={{ href: '/cadastros/clientes', label: 'Voltar para clientes' }}
      />

      {salvo ? (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Cliente salvo.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card">
          <FormCliente acao={salvarCliente.bind(null, cliente.id)} registro={cliente} />
        </div>
        <div className="space-y-4">
          <div className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Contratos ({cliente.contratos.length})
            </h2>
            {cliente.contratos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum contrato ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {cliente.contratos.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/contratos/${c.id}`} className="text-blue-800 hover:underline">
                      #{c.numero} {c.condominio?.nome ?? ''}
                    </Link>
                    <span className="chip chip-free">{STATUS_CONTRATO[c.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Condomínios vinculados
            </h2>
            {cliente.condominios.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {cliente.condominios.map((cond) => (
                  <li key={cond.id}>
                    <Link href={`/cadastros/condominios/${cond.id}`} className="text-blue-800 hover:underline">
                      {cond.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Escopo de cobrança de cada contrato define se o boleto é único do condomínio ou por unidade.
            </p>
          </div>

          {admin && !cliente.nome.startsWith('Morador anonimizado') ? (
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Pedido LGPD</h2>
              <p className="mb-3 text-xs text-slate-500">
                Anonimiza os dados pessoais deste cliente: nome vira apelido e documento, contato e endereço somem. Os
                títulos já emitidos guardam o nome do devedor na emissão, então a matriz e o histórico não mudam. Só
                funciona com contrato, adesão e titularidade de unidade encerrados.
              </p>
              <FormLgpd acao={anonimizarCliente.bind(null, cliente.id)} />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

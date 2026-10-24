import Link from 'next/link';
import { exigirPagina } from '@/auth/guard';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { salvarEquipamento } from '@/server/acoes/equipamentos';
import { STATUS_CONTRATO } from '@/lib/rotulos';
import { brl } from '@/domain/money';
import { Cabecalho } from '@/ui/pagina';
import { FormEquipamento } from '../form';
import { listasParaEquipamento } from '../dados';

export const metadata = { title: 'Equipamento' };

export default async function EquipamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/cadastros/equipamentos/[id]');
  const { id } = await params;
  const salvo = (await searchParams).salvo !== undefined;

  const [equipamento, { condominios, grupos }] = await Promise.all([
    prisma.equipamento.findUnique({
      where: { id },
      include: {
        condominio: { select: { id: true, nome: true } },
        unidade: { select: { id: true, codigo: true } },
        contratoItens: {
          include: { contrato: { include: { cliente: true } } },
          orderBy: { vigenciaDesde: 'desc' },
        },
      },
    }),
    listasParaEquipamento(),
  ]);
  if (!equipamento) notFound();

  return (
    <>
      <Cabecalho
        titulo={`Equipamento ${equipamento.numeroSerie}`}
        descricao={`${equipamento.modelo} · ${
          equipamento.condominio ? equipamento.condominio.nome : 'sem condomínio'
        }${equipamento.unidade ? ` · ${equipamento.unidade.codigo}` : ''}`}
        voltar={{ href: '/cadastros/equipamentos', label: 'Voltar para equipamentos' }}
      />
      {salvo ? (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Equipamento salvo.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card">
          <FormEquipamento
            acao={salvarEquipamento.bind(null, equipamento.id)}
            registro={equipamento}
            condominios={condominios}
            grupos={grupos}
          />
        </section>
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Coberto por {equipamento.contratoItens.length} item(ns) de contrato
          </h2>
          {equipamento.contratoItens.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum contrato cobra este equipamento. Vincule-o ao item do contrato para que entre na cobrança
              recorrente.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {equipamento.contratoItens.map((ci) => (
                <li key={ci.id} className="flex items-center justify-between gap-2">
                  <Link href={`/contratos/${ci.contratoId}`} className="text-blue-800 hover:underline">
                    #{ci.contrato.numero} · {ci.contrato.cliente.nome}
                  </Link>
                  <span className="num text-xs text-slate-500">{brl(ci.precoAtual)}</span>
                  <span className="chip chip-free">{STATUS_CONTRATO[ci.contrato.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

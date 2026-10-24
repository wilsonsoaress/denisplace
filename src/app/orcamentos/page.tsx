import Link from 'next/link';
import { exigirPagina, podeEditar } from '@/auth/guard';
import { Prisma, type StatusOrcamento } from '@prisma/client';
import { prisma } from '@/server/db';
import { brl } from '@/domain/money';
import { hoje, toISO } from '@/domain/dates';
import { STATUS_ORCAMENTO } from '@/lib/rotulos';
import { Cabecalho, Filtro, Vazio } from '@/ui/pagina';
import { CHIP_ORCAMENTO } from './dados';

export const metadata = { title: 'Orçamentos' };

const STATUS_VALIDOS = Object.keys(STATUS_ORCAMENTO) as StatusOrcamento[];

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/orcamentos');
  const editar = await podeEditar('orcamentos');
  const bruto = await searchParams;
  const q = typeof bruto.q === 'string' ? bruto.q : '';
  const statusBruto = typeof bruto.status === 'string' ? bruto.status : '';
  const status = STATUS_VALIDOS.includes(statusBruto as StatusOrcamento) ? (statusBruto as StatusOrcamento) : '';

  const where: Prisma.OrcamentoWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { titulo: { contains: q, mode: 'insensitive' } },
            { cliente: { nome: { contains: q, mode: 'insensitive' } } },
            { condominio: { nome: { contains: q, mode: 'insensitive' } } },
            ...(/^\d+$/.test(q) ? [{ numero: Number(q) }] : []),
          ],
        }
      : {}),
  };

  const [orcamentos, contagem] = await Promise.all([
    prisma.orcamento.findMany({
      where,
      include: {
        cliente: { select: { id: true, nome: true } },
        condominio: { select: { id: true, nome: true } },
        contrato: { select: { id: true, numero: true } },
        _count: { select: { itens: true, ordensServico: true } },
      },
      orderBy: [{ status: 'asc' }, { numero: 'desc' }],
      take: 300,
    }),
    prisma.orcamento.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const por = (s: StatusOrcamento) => contagem.find((c) => c.status === s)?._count._all ?? 0;
  const convertidos = por('CONVERTIDO');
  // Taxa sobre o que saiu do escritório: enviado, aprovado, recusado, expirado ou convertido.
  const enviados = ['ENVIADO', 'APROVADO', 'RECUSADO', 'EXPIRADO', 'CONVERTIDO'].reduce(
    (acc, s) => acc + por(s as StatusOrcamento),
    0,
  );
  const taxa = enviados === 0 ? null : Math.round((convertidos / enviados) * 100);

  return (
    <>
      <Cabecalho
        titulo="Orçamentos"
        descricao="Entrada única do negócio: item pontual vira ordem de serviço e item recorrente vira contrato, com a origem gravada para medir conversão."
        acoes={
          editar ? (
            <Link href="/orcamentos/novo" className="btn btn-primary">
              Novo orçamento
            </Link>
          ) : null
        }
      />

      <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <p className="card !py-2">
          Abertos: <b className="num">{por('ABERTO')}</b>
          <span className="block text-xs text-slate-500">ainda não saíram do escritório</span>
        </p>
        <p className="card !py-2">
          Enviados: <b className="num">{por('ENVIADO')}</b>
          <span className="block text-xs text-slate-500">aguardando resposta do cliente</span>
        </p>
        <p className="card !py-2">
          Aprovados a converter: <b className="num">{por('APROVADO')}</b>
          <span className="block text-xs text-slate-500">prontos para gerar contrato e OS</span>
        </p>
        <p className="card !py-2">
          Taxa de conversão: <b className="num">{taxa === null ? '—' : `${taxa}%`}</b>
          <span className="block text-xs text-slate-500">{convertidos} convertidos de {enviados} enviados</span>
        </p>
      </div>

      <Filtro acao="/orcamentos" q={q} placeholder="Cliente, condomínio, título ou número">
        <select name="status" defaultValue={status} className="input max-w-44">
          <option value="">todos os status</option>
          {STATUS_VALIDOS.map((s) => (
            <option key={s} value={s}>
              {STATUS_ORCAMENTO[s]}
            </option>
          ))}
        </select>
      </Filtro>

      {orcamentos.length === 0 ? (
        <Vazio>Nenhum orçamento com esses filtros.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="grid">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Cliente / condomínio</th>
                <th>Título</th>
                <th>Validade</th>
                <th className="text-right">Valor</th>
                <th>Itens</th>
                <th>Status</th>
                <th>Saiu em</th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orcamentos/${o.id}`} className="font-medium text-blue-800 hover:underline">
                      #{o.numero}
                    </Link>
                  </td>
                  <td>
                    {o.cliente.nome}
                    {o.condominio ? (
                      <span className="block text-xs text-slate-500">{o.condominio.nome}</span>
                    ) : null}
                  </td>
                  <td className="max-w-64">{o.titulo}</td>
                  <td className="num">
                    {toISO(o.validade)}
                    {o.status === 'ABERTO' || o.status === 'ENVIADO' ? (
                      <span className="block text-xs text-slate-500">
                        {(toISO(o.validade) ?? '') < hoje() ? 'passou da validade' : ''}
                      </span>
                    ) : null}
                  </td>
                  <td className="num text-right">{brl(o.valorTotal)}</td>
                  <td className="text-xs text-slate-600">
                    {o._count.itens} item(ns) · {o._count.ordensServico} OS
                  </td>
                  <td>
                    <span className={CHIP_ORCAMENTO[o.status]}>{STATUS_ORCAMENTO[o.status]}</span>
                    {o.contrato ? (
                      <Link href={`/contratos/${o.contrato.id}`} className="ml-1 text-xs text-blue-800 hover:underline">
                        contrato #{o.contrato.numero}
                      </Link>
                    ) : null}
                  </td>
                  <td className="num text-xs text-slate-500">
                    {toISO(o.aprovadoEm) ?? '—'}
                    {o.convertidoEm ? <span className="block">convertido {toISO(o.convertidoEm)?.slice(0, 10)}</span> : null}
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

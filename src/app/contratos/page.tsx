import Link from 'next/link';
import { exigirPagina, podeEditar } from '@/auth/guard';
import { Prisma, type EscopoCobranca, type StatusContrato } from '@prisma/client';
import { prisma } from '@/server/db';
import { brl } from '@/domain/money';
import { toISO } from '@/domain/dates';
import { Cabecalho, Filtro, Vazio, param } from '@/ui/pagina';
import { ESCOPO_COBRANCA, STATUS_CONTRATO, opcoes } from '@/lib/rotulos';
import { chipStatus, mensalDe } from './dados';

export const metadata = { title: 'Contratos' };

const STATUS_VALIDOS = Object.keys(STATUS_CONTRATO) as StatusContrato[];
const ESCOPOS_VALIDOS = Object.keys(ESCOPO_COBRANCA) as EscopoCobranca[];

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/contratos');
  const editar = await podeEditar('contratos');
  const q = await param(searchParams, 'q');
  const statusBruto = await param(searchParams, 'status');
  const escopoBruto = await param(searchParams, 'escopo');
  const condominioId = await param(searchParams, 'condominio');
  const status = STATUS_VALIDOS.includes(statusBruto as StatusContrato) ? (statusBruto as StatusContrato) : '';
  const escopo = ESCOPOS_VALIDOS.includes(escopoBruto as EscopoCobranca) ? (escopoBruto as EscopoCobranca) : '';

  const condominios = await prisma.condominio.findMany({
    select: { id: true, nome: true, cidade: true },
    orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
  });

  const where: Prisma.ContratoWhereInput = {
    ...(status ? { status } : {}),
    ...(escopo ? { escopo } : {}),
    ...(condominioId ? { condominioId } : {}),
    ...(q
      ? {
          OR: [
            { cliente: { nome: { contains: q, mode: 'insensitive' } } },
            { condominio: { nome: { contains: q, mode: 'insensitive' } } },
            ...(/^\d+$/.test(q) ? [{ numero: Number(q) }] : []),
          ],
        }
      : {}),
  };

  const contratos = await prisma.contrato.findMany({
    where,
    include: {
      cliente: { select: { id: true, nome: true } },
      condominio: { select: { id: true, nome: true } },
      itens: { where: { ativo: true }, select: { ativo: true, quantidade: true, precoAtual: true } },
      _count: { select: { aderencias: true } },
    },
    orderBy: [{ status: 'asc' }, { numero: 'asc' }],
    take: 300,
  });

  const receitaMensal = mensalDe(contratos.flatMap((c) => c.itens));

  return (
    <>
      <Cabecalho
        titulo="Contratos"
        descricao="Vigência, itens com preço vigente, reajuste versionado e adesões por unidade. Só contrato VIGENTE entra na cobrança do mês."
        acoes={
          editar ? (
            <Link href="/contratos/novo" className="btn btn-primary">
              Novo contrato
            </Link>
          ) : null
        }
      />
      <Filtro acao="/contratos" q={q} placeholder="Nome do cliente, condomínio ou nº do contrato">
        <select name="status" defaultValue={status} className="input max-w-40">
          <option value="">todos os status</option>
          {opcoes(STATUS_CONTRATO).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="escopo" defaultValue={escopo} className="input max-w-44">
          <option value="">todo escopo</option>
          {opcoes(ESCOPO_COBRANCA).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="condominio" defaultValue={condominioId} className="input max-w-56">
          <option value="">todos os condomínios</option>
          {condominios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Filtro>

      <p className="mb-3 text-sm text-slate-600">
        {contratos.length} contrato(s) · mensalidade bruta somada{' '}
        <b className="num">{brl(receitaMensal)}</b>
      </p>

      {contratos.length === 0 ? (
        <Vazio>
          Nenhum contrato encontrado{q ? ` para “${q}”` : ''}.{' '}
          <Link href="/contratos/novo" className="text-blue-800 underline">
            Criar o primeiro.
          </Link>
        </Vazio>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="grid">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Cliente</th>
                <th>Condomínio</th>
                <th>Cobrança</th>
                <th>Vigência</th>
                <th className="num">Venc.</th>
                <th className="num">Itens</th>
                <th className="num">Unidades</th>
                <th className="num">Mensal bruto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id}>
                  <td className="num">
                    <Link href={`/contratos/${c.id}`} className="font-medium text-blue-800 hover:underline">
                      #{c.numero}
                    </Link>
                    {c.parentContractId ? <span className="chip chip-free ml-2">filho</span> : null}
                  </td>
                  <td>
                    <Link href={`/cadastros/clientes/${c.cliente.id}`} className="hover:underline">
                      {c.cliente.nome}
                    </Link>
                  </td>
                  <td>{c.condominio?.nome ?? '—'}</td>
                  <td className="text-xs">{ESCOPO_COBRANCA[c.escopo]}</td>
                  <td className="num text-xs">
                    {toISO(c.inicio)} → {c.fim ? toISO(c.fim) : 'indeterminado'}
                  </td>
                  <td className="num">{c.vencimentoDia}</td>
                  <td className="num">{c.itens.length}</td>
                  <td className="num">{c.escopo === 'UNIDADE' ? c._count.aderencias : '—'}</td>
                  <td className="num font-medium">{brl(mensalDe(c.itens))}</td>
                  <td>
                    <span className={chipStatus(c.status)}>{STATUS_CONTRATO[c.status]}</span>
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
